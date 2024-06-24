import { Menu, Tray, app } from "electron";

import debug from "debug";
import { join } from "path";
import { logger } from "../config";
import { platform } from "os";
import { clearActivity, restartClient, rpcClient, setActivity } from "@managers/discordManager";
import { AlbumPrefs, ArtistPrefs, store } from "@util/config";
import { Album, Track, getArtistString } from "@classes/song";

let trayIcon: string;

switch (platform()) {
	case "darwin":
		trayIcon = join(__dirname, "../assets/macos.png");
		break;
	case "win32":
		trayIcon = join(__dirname, "../assets/windows.ico");
		break;
}

export default class TrayManager {
	systray: Tray;
	logger: debug.Debugger;
	constructor() {
		this.systray = new Tray(trayIcon);
		this.logger = logger.extend("TrayManager");

		app.on("will-quit", () => {
			this.systray.destroy();
		});
	}

	update(song?: Track, album?: Album) {
		const menu = Menu.buildFromTemplate([
			{
				label: `WavesRPC ${app.getVersion()}`,
				enabled: false
			},
			{
				label: `Playing: ${getArtistString(song?.artists)} - ${song?.title}`,
				enabled: false,
				visible: song ? true : false
			},
			{
				type: "separator"
			},
			{
				label: "Settings",
				submenu: [
					{
						label: "Start at System Startup",
						type: "checkbox",
						checked: store.get("autoStart"),
						enabled: app.isPackaged ? true : false,
						click: () => {
							store.set("autoStart", !store.get("autoStart"));
							store.get("autoStart") && app.isPackaged
								? app.setLoginItemSettings({
										openAtLogin: true,
										openAsHidden: true
								  })
								: app.setLoginItemSettings({ openAtLogin: false });
						}
					},
					{
						label: "Show Rich Presence",
						type: "checkbox",
						checked: store.get("showPresence"),
						click: () => {
							store.set("showPresence", !store.get("showPresence"));
							if (
								typeof rpcClient !== "undefined" &&
								!store.get("showPresence")
							)
								rpcClient.clearActivity();
						}
					},
					{
						label: "Rich Presence settings",
						submenu: [
							{
								label: "Show Buttons in Rich Presence",
								type: "checkbox",
								checked: store.get("showButtons"),
								click: () => store.set("showButtons", !store.get("showButtons"))
							},
							{ 
								type: "separator"
							},
							{
								label: "Album Display Options",
								enabled: false
							},
							{
								label:  `${album?.title}` || `[ALBUM NAME]`,
								type: "radio",
								checked: store.get("albumPrefs") == AlbumPrefs.justName,
								click: () => store.set("albumPrefs", AlbumPrefs.justName)
							},
							{
								label: `${album?.title} (${album?.releaseYear})` || `[ALBUM NAME] ([ALBUM YEAR])`,
								type: "radio",
								checked: store.get("albumPrefs") == AlbumPrefs.withYear,
								click: () => store.set("albumPrefs", AlbumPrefs.withYear)
							},
							{ 
								type: "separator"
							},
							{
								label: "Song Display Options",
								enabled: false
							},
							{
								label: `${song?.title}` || `[SONG TITLE]`,
								sublabel: `${getArtistString(song?.artists)}` || `[SONG ARTIST]`,
								type: "radio",
								checked: store.get("artistPrefs") == ArtistPrefs.justName,
								click: () => store.set("artistPrefs", ArtistPrefs.justName)
							},
							{
								label: `${song?.title}` || `[SONG TITLE]`,
								sublabel: `by ${getArtistString(song?.artists)}` || `by [SONG ARTIST]`,
								type: "radio",
								checked: store.get("artistPrefs") == ArtistPrefs.byName,
								click: () => store.set("artistPrefs", ArtistPrefs.byName)
							}
						]
					}
				]
			},
			{
				label: "Restart Discord Client",
				click: () => { restartClient(); }
			},
			{
				label: "Exit",
				role: "quit"
			}
		]);
		this.systray.setContextMenu(menu);
	}
}
