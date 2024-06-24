import Store from "electron-store";

export const enum ArtistPrefs {
	justName,
	byName
}
export const enum AlbumPrefs {
	justName,
	withYear
}
export const enum SortingPrefs {
	HighestTrackCount,
	NoSort
}
export type UserPrefs = {
	artistFormat: ArtistPrefs;
	albumFormat: AlbumPrefs;
	songSort: SortingPrefs;
}

export const store = new Store({
	defaults: {
		showPresence: true,
		showButtons: true,
		autoStart: true,
		userPrefs: {
			artistFormat: ArtistPrefs.justName,
			albumFormat: AlbumPrefs.justName,
			songSort: SortingPrefs.NoSort
		}
	}
});

export const TIDALstore = new Store<Record<string, string>>();
