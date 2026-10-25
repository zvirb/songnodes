export interface AISetlistTrack {
  position: number;
  artist: string;
  title: string;
  mix: string | null;
  label: string | null;
}

export interface AISetlist {
  dj: string;
  event: string;
  date: string | null;
  venue: string | null;
  genre: string | null;
  source_url: string;
  tracks: AISetlistTrack[];
}

export interface AISetlistsResponse {
  schema: 'songnodes.setlists.v1';
  setlists: AISetlist[];
}
