interface TidalPicture {
	url: string;
	width: number;
	height: number;
}

export interface TidalArtist {
	id: number;
	name: string;
	main: boolean;
}

interface TidalMiniAlbum {
	id: number;
	title: string;
	imageCover: TidalPicture[];
}

class TidalMiniAlbum {
	constructor(config: Album | TidalAlbum | TidalMiniAlbum = undefined) {
		this.id = config?.id ?? undefined;
		this.title = config?.title ?? undefined;
		this.imageCover = config?.imageCover ?? [];
	}
}

export interface TidalAlbum extends TidalMiniAlbum {
	/** format: "YYYY-MM-DD" */
	releaseDate: string;
	numberOfTracks: number;
	artists: TidalArtist[];
};

export interface Album extends TidalAlbum {}

export class Album {
	get releaseYear(): number {
		return new Date(this.releaseDate).getUTCFullYear();
	}

	constructor (config: Album | TidalAlbum | TidalMiniAlbum = undefined) {
		this.id = config?.id ?? undefined;
		this.title = config?.title ?? undefined;
		this.imageCover = config?.imageCover ?? [];

		this.releaseDate = config ? config["releaseDate"] ?? undefined : undefined;
		this.numberOfTracks = config ? config["numberOfTracks"] ?? undefined : undefined;
		this.artists = config ? config["artists"] ?? [] : [];
	}
}


export interface TidalTrack {
	id: number;
	title: string;
	releaseDate: string;
	duration: number;
	artists: TidalArtist[];
	album: TidalMiniAlbum;
	tidalUrl: string;
};
export interface Track extends TidalTrack {
}

export class Track {
	constructor(config : Track | TidalTrack = undefined) {
		this.id = config?.id ?? undefined;
		this.title = config?.title ?? undefined;
		this.artists = config?.artists ?? undefined;
		this.duration = config?.duration ?? 0;
		this.album = new TidalMiniAlbum(config?.album);
		this.artists = config?.artists ?? [];
		this.tidalUrl = config?.tidalUrl ?? undefined;
	}
}

export const getMainArtist = (artists: TidalArtist[]): TidalArtist => {
	return artists.find((artist) => {
		return artist.main === true;
	});
}

export const getArtistString = (artists: TidalArtist[]): string => {
	if (!artists) return undefined;

	let authorString;
	if (artists.length > 1) {
		const authorsArray = Array.from(artists);
		authorString = authorsArray
			.slice(0, authorsArray.length)
			.map(a => a?.name)
			.join(", ");
	} else authorString = artists[0]?.name;

	return authorString;
}

export const getHighestResPicture = (pictures: TidalPicture[]): TidalPicture => {
	return pictures.sort((a, b) => a.width - b.width)[0];
}