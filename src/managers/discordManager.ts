import Discord from "discord-game";
import { logger } from "../config";
import { AlbumPrefs, ArtistPrefs, store } from "@util/config";
import { getArtistString, getHighestResPicture } from "@classes/song";
import { PlayingTrack } from "./tidalManager";
import { env } from "process";

export let rpcClient: DiscordClient;

const blankActivity: Discord.Activity.Activity = {
	assets: {},
	timestamps: {},
	secrets: {},
	party: {}
}

const isDiscordRequired = true;

class DiscordClient {
	clientId: string;
	private ready = false;
	private activityCleared = false;
	private activity: Discord.Activity.Activity;
	lastCall: number = Date.now() - 5000;

	constructor() {
		rpcClient = this;
		Discord.create(env.discordClientId, isDiscordRequired);

		console.log(`DiscordManager: info: Client Created. GameSDK version ${Discord.version}`)

		Discord.Application
       .getOAuth2Token()
       .then(function(token) { console.log('Token is', token) });
		
		setInterval(() => {
			Discord.runCallback();
		}, 1000/60)
	}

	setActivity(data?: Discord.Activity.Activity) {
		data = data ?? this.activity;
		if (!this.ready) return;
		if (this.activityCleared) this.activityCleared = false;

		Discord.Activity
			.update(data)
			.then((success) => {
				if (success) {
					this.activity = data;
					console.log("SetActivity: info: Rich Presence updated");
					return;
				}
				console.error(`SetActivity: error: Couldn't set discord rice presence!`);
			})
			.catch((e) => console.error(`SetActivity: error: ${e}`));
	}

	clearActivity() {
		if (!this.ready || this.activityCleared) return;

		Discord.Activity
			.update(blankActivity)
			.then((success)=> {
				if (success) {
					console.log("ClearActivity: info: Rich Presence cleared");
					this.activity = blankActivity;
					return;
				}
				console.error(`ClearActivity: error: failed to clear discord activity!`);
			})
			.catch((e) => console.error(`ClearActivity: error: ${e}`));
		this.activityCleared = true;
	}

	destroyClient() {
		if (!this.ready) return;
		this.clearActivity();
		rpcClient = null;
	}
}

export const restartClient = () => {
	rpcClient?.destroyClient();
	rpcClient = new DiscordClient();
}

export const setActivity = (currTrack: PlayingTrack) => {
		if (!currTrack?.startTime) return clearActivity();

		const presenceData = blankActivity;

		presenceData.assets.largeImage = getHighestResPicture(currTrack.album.imageCover).url


		if (currTrack.album) {
			switch (store.get("albumPrefs")) {
				case AlbumPrefs.withYear:
					presenceData.assets.largeText = `${currTrack.album.title} (${Date.parse(currTrack.album.releaseDate)})`;
					break;
				default:
				case AlbumPrefs.justName:
					presenceData.assets.largeText = `${currTrack.album.title}`;				
					break;
				}
		}

		if (!currTrack.track.duration) presenceData.timestamps.startAt = new Date(currTrack.startTime);
		else presenceData.timestamps.endAt =
				new Date(currTrack.startTime + currTrack.track.duration + currTrack.pausedTime);

		switch(store.get("artistPrefs")) {
			case ArtistPrefs.byName:
				presenceData.state = `by ${getArtistString(currTrack.track.artists)}`;
				break;
			default:
			case ArtistPrefs.justName:
				presenceData.state = `${getArtistString(currTrack.track.artists)}`;
		}
		presenceData.details = currTrack.track.title;

		/** As of writing, Discord's gameSDK does not support custom buttons in rich presence.
		 * 
		 * 
		if (currTrack.buttons && currTrack.buttons.length !== 0 && store.get("showButtons"))
			presenceData.buttons = currTrack.buttons;
		*/

		if (currTrack.track.duration && presenceData.timestamps.startAt) {
			delete presenceData.timestamps.startAt;
		}

		if (!rpcClient) {
			restartClient();
		}

		if (rpcClient && Date.now() - rpcClient.lastCall < 5000) return;
		if (rpcClient) rpcClient.lastCall = Date.now();

		rpcClient.setActivity(presenceData);
	},
	clearActivity = () => {
		if (!rpcClient) return;
		rpcClient.clearActivity();
	},
	destroyClient = () => {
		if (!rpcClient) return;
		rpcClient.destroyClient();
	};
