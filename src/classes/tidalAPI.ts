import axios, { AxiosInstance } from "axios";
import { BrowserWindow, ipcMain } from "electron";
import { TidalAlbum } from "./song";

type AuthCredentials = { credentialsStorageKey, clientId, clientSecret };
export default class TidalAPI {
	private baseURL: string;
	private axios: AxiosInstance;
	private isResultPending: boolean;
	constructor() {
		this.baseURL = "https://openapi.tidal.com";
		this._initializeAxios().then(() => this.isResultPending = false);
	}

	async searchSong(query: string, limit = 20) {
		if (this.isResultPending) return;
		if (!query) return console.error("SearchSong: error: No query specified.");

		this.isResultPending = true;
		try {
			if (!this.axios) return console.error("SearchSong: error: Axios not initialized! retrying..."), 
				await this._initializeAxios();
			const res = await this.axios({
				method: "GET",
				url: "/search",
				params: {
					query,
					limit,
					offset: 0,
					countryCode: "US",
					type: "TRACKS"
				},
				timeout: 120000
			});

			if (res.data.tracks.length === 0) {
				this.isResultPending = false;
				console.log(`SearchSong: warn: no tracks found for ${query}`);
				return [];
			}

			this.isResultPending = false;
			return res.data.tracks.map((track) => track.resource);
		} catch (err) {
			console.error(err);
			this.isResultPending = false;
			return [];
		}
	}

	async getAlbumsById(idsArr: number[]): Promise<TidalAlbum[]> {
		if (!idsArr || idsArr.length === 0) return console.error("getAlbumsById: error: No query specified."), [];

		try {
			const res = await this.axios({
				method: "GET",
				url: `/albums/byIds`,
				params: {
					ids: idsArr.toString(),
					countryCode: "US"
				},
				timeout: 15000
			});

			if (res.status === 404) return [];

			return res.data.data.map((album) => album.resource);
		} catch (err) {
			console.error(`getAlbumsById: error: ${err}`);
			return [];
		}
	}

	private async _initializeAxios(): Promise<void> {
		const oldthis = this;

		await this._forkAuthProcess()
		.then((token) => {
			oldthis.axios = axios.create({
				baseURL: oldthis.baseURL,
				headers: {
					"Authorization": `Bearer ${token}`,
					"accept": "application/vnd.tidal.v1+json",
					"Content-Type": "application/vnd.tidal.v1+json"
				}
			});
		});
	}

	private async _forkAuthProcess(): Promise<any> {
		console.log(`id: ${process.env.clientId}`)
		const authChild = new BrowserWindow({
			webPreferences: {
				preload: `${__dirname}\\tidalAuthPreload.js`,
				sandbox: false
			},
			show: false
		});
		authChild.loadFile(`assets/tidalAuth.html`);

		const promise = new Promise((resolve, reject) => {
			ipcMain.once('auth', (e, a) => {
				a.token ? resolve(a.token) : reject();
			});
		});

		return promise;
	}
}
