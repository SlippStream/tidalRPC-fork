import { clearActivity, setActivity } from "@managers/discordManager";

import Process from "@classes/process";
import TidalAPI from "@classes/tidalAPI";
import { SortingPrefs, store, TIDALstore } from "@util/config";
import { trayManager } from "../index";
import { TidalStatus } from "@interfaces/tidalStatus";
import { Album, getArtistString, TidalAlbum, TidalArtist, TidalTrack, Track } from "@classes/song";


type TidalTrackAlbumTuple = {
	track: TidalTrack;
	album: TidalAlbum;
}

export type PlayingTrack = {
	track: Track;
	album: Album;
	/** Start timestamp for this track */
	startTime: number;
	/** Pause timestamp for this track */
	pausedTime: number;
	/** How this appears in the TIDAL process window title */
	windowTitle: string;
	buttons?: { label: string; url: string }[];
}
const ARTIST_DELIMITER: string = ", ";
const TITLE_DELIMITER: string = " - ";
export default class TidalManager {
	private isResultPending: boolean;
	private api: TidalAPI;
	private currentPlaying: PlayingTrack;
	constructor() {
		this.api = new TidalAPI();
		this._clearCurrentSong();
	}

	async rpcLoop() {
		const tidalStatus = await (await this._getTidalProcess()).tidalStatus;
		switch (tidalStatus.status) {
			case "closed":
					clearActivity();
					return this._clearCurrentSong();

			case "opened":
					//console.log("status: opened");
					if (this.currentPlaying.track.title) this.currentPlaying.pausedTime += 1;
					return clearActivity();

			case "playing": {
				if (this.currentPlaying?.windowTitle === tidalStatus?.windowTitle) {}
				else if (!this.isResultPending) {
					await this._updateSong(tidalStatus);
				}

				trayManager.update(this.currentPlaying.track, this.currentPlaying.album);
				if (!store.get("showPresence")) return clearActivity();
				return setActivity(this.currentPlaying);
			}
		}
	}

	private async _updateSong(status: TidalStatus): Promise<void> {
		this.isResultPending = true;
		/**
		 * Window title format: "[TRACK NAME] - [ARTIST NAME]"
		 * Example: "Shake It Off - Taylor Swift" 
		 * 
		 *! This solution is imperfect. It will split within an artist or track's name
		*! if the delimiter is present.
		* @see _accountForDelimiter
		*/
		let windowTitle = status.windowTitle?.trim().split(TITLE_DELIMITER);
		if (!windowTitle)
			return console.error("UpdateSong: error: Can't get current song");

		const title = windowTitle[0].trim(),
			/** Because the window title may not be split perfectly, we take
			 * the last token, as it's guaranteed to be part of the artist name. 
			*/  
			authors = windowTitle[windowTitle.length - 1].trim().split(ARTIST_DELIMITER);

		let searchResults: TidalTrack[] = await this.api.searchSong(
			`${title} ${authors.toString()}`
		);
		
		if (!searchResults || searchResults.length === 0) {
			/** TIDAL's api will occasionally return no results for songs with very long names.
			 * So, we truncate the title when we try again
			 */ 
			searchResults = await this.api.searchSong(`${title.substring(0,40)} ${authors[0]}`);

			if (!searchResults || searchResults.length === 0) {
				this.isResultPending = false
				return console.error(`UpdateSong: error: Couldn't find current song from name ${status.windowTitle}`)
					, clearActivity()
					, this._clearCurrentSong();
			}

		}

		console.log(`UpdateSong: info: ${searchResults.length} albums found for ${title} by ${authors.toString()}`);
		searchResults.forEach((value, index, array) => {
			if (index > 9) return;
			console.log(`UpdateSong: info: -- [${index}] ${value.album.title} #${value.album.id}`);
			if (index == 9) console.log(`UpdateSong: info: ${array.length - 10} additional items found...`);

		});
		/* Pair the albums with the tracks that appear on them */
		const albumList: Array<TidalAlbum> = 
			await this.api.getAlbumsById(searchResults
				.map((val) => val.album.id)
			);
		const timeNow = ~~(new Date().getTime() / 1000);


		const tupleList: TidalTrackAlbumTuple[] = albumList.map<TidalTrackAlbumTuple>((value, index, array) => 
			{
				return { 
					track: searchResults[index],
					album: value
				}
			});

		/* Sort the found tracks by the user's preference */
		this._sortSongs(tupleList, store.get("userPrefs").songSort);

		console.log(`UpdateSong: info: ${tupleList.length} entries found for ${title} by ${authors.toString()}`)
		tupleList.forEach((value, index, array) => {
			if (index > 9) return;
			console.log(`UpdateSong: info: -- [${index}] ${value.album.title}`);
			if (index == 9) console.log(`UpdateSong: info: ${array.length - 10} additional items found...`);
		});

		let foundResult: TidalTrackAlbumTuple = tupleList
			.find(s => {
				if (s.track.title === title && authors.length === s.track.artists.length)
					return s;
			});

		if (!foundResult) {
			foundResult = tupleList
			.find(s => {
				console.log(`UpdateSong: info: checking ${s.track.title} by ${s.track.artists.length} artists (expecting ${title} by ${authors.length} artists)`);
				if (s.track.title === title 
					&& authors.length === this._accountForDelimiter(s.track.artists, ARTIST_DELIMITER))
					return s;
			});

			if (!foundResult) {
				this.isResultPending = false
				return console.error(`UpdateSong: error: Couldn't find an exact match in TIDAL's API for ${title} by ${authors.toString()}`);
			}
		}

		if (
			timeNow - this.currentPlaying.startTime + this.currentPlaying.pausedTime 
				>= this.currentPlaying.track.duration 
			|| (this.currentPlaying.track.title !== foundResult.track.title 
				&& getArtistString(this.currentPlaying.track.artists) !== (getArtistString(foundResult.track.artists)))
		) {
			this.currentPlaying.startTime = timeNow;
			this.currentPlaying.pausedTime = 0;
		}

		this.currentPlaying.track = new Track(foundResult.track);
		this.currentPlaying.album = new Album(foundResult.album);
		this.currentPlaying.windowTitle = status.windowTitle;

		this.currentPlaying.buttons = [];
		if (foundResult.track.tidalUrl) {
			this.currentPlaying.buttons?.push({
				label: "Play on Your Streaming Platform",
				url: `${foundResult.track.tidalUrl}?u` //The '?u' allows opening the track on other platforms
			});
		}

		this.isResultPending = false;
		console.log(this.currentPlaying);
	}

	private _clearCurrentSong() {
		this.currentPlaying = {
			track: new Track(),
			album: new Album(),
			startTime: 0,
			pausedTime: 0,
			windowTitle: undefined
		};

		trayManager.update();
	}

	private async _getTidalProcess(): Promise<Process> {
		const proc = new Process();
		await proc.getTidalTitle();

		return proc;
	}

	private _sortSongs(tuples: TidalTrackAlbumTuple[], sort: SortingPrefs): void {
		if (sort === SortingPrefs.NoSort || tuples.length <= 1) return;

		switch(sort) {
			case SortingPrefs.HighestTrackCount:
				tuples.sort((a, b) => a.album.numberOfTracks - b.album.numberOfTracks);
				break;
		}
	}

	/** Given a correctly tokenized array of artists or artist names, finds
	 * the number of tokens our parser _would_ have parsed them as
	 * 
	 * @param tokens the artist names or TidalArtist objects
	 * @param delimiter the delimiter used to split the artist names
	 * @returns the number of tokens (artists) that would have been read from the Tidal process
	 */
	private _accountForDelimiter(tokens: string[] | TidalArtist[], delimiter): number {
		let sum = 0;
		switch (typeof tokens[0]) {
			case "string":
				tokens.forEach((token) => {
					sum += (token as string).split(delimiter).length;
				});
				break;
			case "object":
				tokens.forEach((token) => {
					sum += (token as TidalArtist)?.name.split(delimiter).length;
				});
				break;
		}
		return sum;
	}
}
