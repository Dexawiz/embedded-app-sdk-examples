import type { CommandResponse } from '@discord/embedded-app-sdk';
import './style.css';
import { discordSdk } from './discordSdk';
import.meta.env.VITE_CLIENT_ID;

// import { response } from 'express';

const SERVER_URL = 'https://definition-customs-writings-actions.trycloudflare.com';


const audio = new Audio('/miska.mp3');
const lyricsList = document.getElementById('lyrics-list');
let lrc: Array<{ time: number; text: string }> = []; 

// Flag to track if user has interacted with the page
let isSynchronized = false;

function showJoinButton(serverTime: number) {
    const overlay = document.getElementById('sync-overlay');
    if (!overlay || overlay.innerHTML !== '') return;

    overlay.innerHTML = `
        <div class="join-card">
            <h2>Хост начал вечеринку!</h2>
            <p>Нажми кнопку, чтобы подстроиться под ритм</p>
            <button id="real-join-btn" class="join-btn-big">Присоединиться к прослушиванию</button>
        </div>
    `;

    document.getElementById('real-join-btn')?.addEventListener('click', () => {
        isSynchronized = true;
        
        // Считаем время и запускаем
        const diffInSeconds = (Date.now() - serverTime) / 1000;
        audio.currentTime = diffInSeconds;
        audio.play().catch(console.error);
        
        overlay.innerHTML = ''; // Очищаем оверлей (он скроется сам из-за CSS)
    });
}




const ws = new WebSocket(`wss://${location.host}/api-ws`);
	ws.onopen = () => {
		console.log('WebSocket connected');
	};

	ws.onerror = (err) => {
		console.error('WS error', err);
	};

	ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('WS Message received:', data);
    if (data.type === 'STATE' || data.type === 'PLAY' || data.type === 'PAUSE') {
        handleState(data.payload);
    }
};

function handleState(state: any) {
    const now = Date.now();
    const diffInSeconds = (now - state.time) / 1000;

    if (state.isPlaying) {
        // Если музыка играет на сервере
        if (!isSynchronized) {
            // Показываем кнопку ТОЛЬКО если юзер вообще еще не входил в сессию
            showJoinButton(state.time);
            return;
        }

        // Если мы уже синхронизированы, просто играем
        const drift = Math.abs(audio.currentTime - diffInSeconds);
        
        if (drift > 0.5 || audio.paused) {
            audio.currentTime = diffInSeconds;
            audio.play().catch((e) => {
                console.error("Автоплей заблокирован:", e);
                isSynchronized = false; 
            });
        }
        
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.textContent = '||';

    } else {
        audio.pause();
        
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.textContent = '▶';
        
        // Оверлей убираем только если он висел
        const overlay = document.getElementById('sync-overlay');
        if (overlay) overlay.innerHTML = '';
    }
}

async function initKaraoke() {
    try {
		// 1. Upload file
        const response = await fetch('/miska.lrc'); 
        let rawLrc = await response.text();
        
        rawLrc = rawLrc.replace(/^\uFEFF/, ''); 
        
        // 2. Parsing
        lrc = parseLrc(rawLrc);
        // console.log('Parsed text:', lrc);

        // 3. Render lines only AFTER data is received
        if (lyricsList) {
            lyricsList.innerHTML = ''; // Clear previous lyrics
            lrc.forEach((line, index) => {
                const p = document.createElement('p');
                p.textContent = line.text;
                p.id = `line-${index}`;
                p.classList.add('lyric-line');
                lyricsList.appendChild(p);
            });
        }
    } catch (e) {
        console.error('Error loading karaoke:', e);
    }
}



// Start initialization of karaoke
initKaraoke();


function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


const initMusic = () => {
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const progressContainer = document.getElementById('progress-container');

    // ПЕРЕМОТКА
    progressContainer?.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const clickPercent = (e.clientX - rect.left) / rect.width;
        const targetTime = clickPercent * (audio.duration || 0);
        
        // Отправляем на сервер команду SEEK
        ws.send(JSON.stringify({ type: 'SEEK', time: targetTime }));
    });

    // КНОПКА "ВКЛЮЧИТЬ ХИТ" (Гарантированный рестарт)
    playBtn?.addEventListener('click', () => {
        isSynchronized = true;
        // Сначала принудительно стопаем и обнуляем сервер
        ws.send(JSON.stringify({ type: 'STOP' }));
        
        // Через микро-паузу запускаем PLAY
        setTimeout(() => {
            ws.send(JSON.stringify({ type: 'PLAY' }));
        }, 50);
    });

    // КНОПКА ПАУЗЫ (Toggle)
    pauseBtn?.addEventListener('click', () => {
        if (audio.paused) {
            ws.send(JSON.stringify({ type: 'PLAY' }));
        } else {
            ws.send(JSON.stringify({ type: 'PAUSE' }));
        }
    });
};



const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const volumeDisplay = document.getElementById('volume-display') as HTMLSpanElement;

if (volumeSlider) {
    volumeSlider.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement;
        		const value = parseFloat(target.value);

				// Update audio volume

				if (audio) {
					audio.volume = value;
				}
				// Update volume display

				if (volumeDisplay) {
					const percent = Math.round(value * 100);
					volumeDisplay.textContent = `${percent}%`;
				}
	});
}


audio.ontimeupdate = () => {
    const currentTime = audio.currentTime;
    const duration = audio.duration || 0;
	//from  html
    const progressFill = document.getElementById('progress-fill') as HTMLDivElement;
    const currentDisplay = document.getElementById('current-time-display');
    const durationDisplay = document.getElementById('duration-display');
    const statusEl = document.getElementById('playback-status');

	// update status text
    if (statusEl) {
        statusEl.textContent = audio.paused ? "Audio is paused" : 'Мишка - Пошлая Молли';
    }

	// update time displays
    if (currentDisplay) currentDisplay.textContent = formatTime(currentTime);
    if (durationDisplay && duration > 0) durationDisplay.textContent = formatTime(duration);

	// update progress bar
    if (progressFill && duration > 0) { 
        const progressPercent = (currentTime / duration) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

	// Highlight current lyric line
    const index = lrc.findLastIndex(line => line.time <= currentTime);
    if (index !== -1) {
        document.querySelector('.lyric-line.active')?.classList.remove('active');
        const activeNode = document.getElementById(`line-${index}`);
        activeNode?.classList.add('active');
        activeNode?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


audio.onended = () => {
    console.log("Песня закончилась");
    // Отправляем сигнал на сервер, чтобы сбросить время в 0
    ws.send(JSON.stringify({ type: 'STOP' }));
    
    // Визуально сбрасываем кнопку паузы
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.textContent = '▶';
    
    isSynchronized = false; // Чтобы при следующем запуске снова сработала синхронизация
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMusic);
} else {
    initMusic();
}

function parseLrc(lrcContent: string): Array<{ time: number; text: string }> {
	const lines = lrcContent.split('\n');
	const lyrics: Array<{ time: number; text: string }> = [];
	const regex = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/;

	for (const line of lines) {
		const match = line.match(regex);
		if (match) {
			const minutes = parseInt(match[1], 10);
			const seconds = parseFloat(match[2]);
			const text = match[3].trim();
			const timeInSeconds = minutes * 60 + seconds;
			lyrics.push({ time: timeInSeconds, text });
		}
	}
	return lyrics;
}



type Auth = CommandResponse<'authenticate'>;
let auth: Auth;

// Once setupDiscordSdk is complete, we can assert that "auth" is initialized
setupDiscordSdk().then(() => {
	appendVoiceChannelName();
	appendGuildAvatar();
});

async function setupDiscordSdk() {
	await discordSdk.ready();

	// Authorize with Discord Client
	const { code } = await discordSdk.commands.authorize({
		client_id: '1473606355100106774',
		response_type: 'code',
		state: '',
		prompt: 'none',
		// More info on scopes here: https://discord.com/developers/docs/topics/oauth2#shared-resources-oauth2-scopes
		scope: [
			// Activities will launch through app commands and interactions of user-installable apps.
			// https://discord.com/developers/docs/tutorials/developing-a-user-installable-app#configuring-default-install-settings-adding-default-install-settings
			'applications.commands',

			// "applications.builds.upload",
			// "applications.builds.read",
			// "applications.store.update",
			// "applications.entitlements",
			// "bot",
			'identify',
			// "connections",
			// "email",
			// "gdm.join",
			'guilds',
			// "guilds.join",
			'guilds.members.read',
			// "messages.read",
			// "relationships.read",
			// 'rpc.activities.write',
			// "rpc.notifications.read",
			// "rpc.voice.write",
			'rpc.voice.read',
			// "webhook.incoming",
		],
	});

	// Retrieve an access_token from your activity's server
	// see https://discord.com/developers/docs/activities/development-guides/networking#construct-a-full-url
	const response = await fetch('/api-ws/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			code,
		}),
	});
	const { access_token } = await response.json();

	// Authenticate with Discord client (using the access_token)
	auth = await discordSdk.commands.authenticate({
		access_token,
	});

	if (auth == null) {
		throw new Error('Authenticate command failed');
	}
}

/**
 * This function fetches the current voice channel over RPC. It then creates a
 * text element that displays the voice channel's name
 */
async function appendVoiceChannelName() {
	const app = document.querySelector<HTMLDivElement>('#app');
	if (!app) {
		throw new Error('Could not find #app element');
	}

	let activityChannelName = 'Unknown';

	// Requesting the channel in GDMs (when the guild ID is null) requires
	// the dm_channels.read scope which requires Discord approval.
	if (discordSdk.channelId != null && discordSdk.guildId != null) {
		// Over RPC collect info about the channel
		const channel = await discordSdk.commands.getChannel({
			channel_id: discordSdk.channelId,
		});
		if (channel.name != null) {
			activityChannelName = channel.name;
		}
	}

	// Update the UI with the name of the current voice channel
	const textTagString = `Activity Channel: "${activityChannelName}"`;
	const textTag = document.createElement('p');
	textTag.textContent = textTagString;
	app.appendChild(textTag);
}

/**
 * This function utilizes RPC and HTTP apis, in order show the current guild's avatar
 * Here are the steps:
 * 1. From RPC fetch the currently selected voice channel, which contains the voice channel's guild id
 * 2. From the HTTP API fetch a list of all of the user's guilds
 * 3. Find the current guild's info, including its "icon"
 * 4. Append to the UI an img tag with the related information
 */
async function appendGuildAvatar() {
	const app = document.querySelector<HTMLDivElement>('#app');
	if (!app) {
		throw new Error('Could not find #app element');
	}

	// 1. From the HTTP API fetch a list of all of the user's guilds
	const guilds: Array<{ id: string; icon: string }> = await fetch(
		'https://discord.com/api/users/@me/guilds',
		{
			headers: {
				// NOTE: we're using the access_token provided by the "authenticate" command
				Authorization: `Bearer ${auth.access_token}`,
				'Content-Type': 'application/json',
			},
		},
	).then((reply) => reply.json());

	// 2. Find the current guild's info, including it's "icon"
	const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);

	// 3. Append to the UI an img tag with the related information
	if (currentGuild != null) {
		const guildImg = document.createElement('img');
		guildImg.setAttribute(
			'src',
			// More info on image formatting here: https://discord.com/developers/docs/reference#image-formatting
			`https://cdn.discordapp.com/icons/${currentGuild.id}/${currentGuild.icon}.webp?size=128`,
		);
		guildImg.setAttribute('width', '128px');
		guildImg.setAttribute('height', '128px');
		guildImg.setAttribute('style', 'border-radius: 50%;');
		app.appendChild(guildImg);
	}
}
