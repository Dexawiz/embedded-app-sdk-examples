import { DiscordSDK } from '@discord/embedded-app-sdk';


let discordSdkInstance: DiscordSDK | null = null;

try {

    discordSdkInstance = new DiscordSDK(import.meta.env.VITE_CLIENT_ID);
} catch (error) {

    console.warn('Discord SDK is not initialized (running outside of Discord?):', error);
}

export const discordSdk = discordSdkInstance as DiscordSDK;