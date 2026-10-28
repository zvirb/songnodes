import React, { useState } from 'react';
import { Dialog, TextField } from '../../components/ds';
import { SavedSet } from '../musicLibrary/data';
import { sendSetToTidal, playlistName, UnmatchedTrack } from './sendToTidal';
import { useToaster } from '../musicLibrary/components/ui';

interface SendToTidalDialogProps {
  open: boolean;
  set: SavedSet | null;
  onClose: () => void;
}

export const SendToTidalDialog: React.FC<SendToTidalDialogProps> = ({ open, set, onClose }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState<UnmatchedTrack[] | null>(null);
  const { toast } = useToaster();

  if (!open || !set) return null;

  const handleSend = async () => {
    setBusy(true);
    setUnmatched(null);
    try {
      const result = await sendSetToTidal(set, note);

      toast(
        <span>
          Playlist created in TIDAL <a href={result.url} target="_blank" rel="noreferrer" className="sn-link">Open</a>
        </span>
      );

      if (result.unmatched.length > 0) {
        setUnmatched(result.unmatched);
      } else {
        onClose();
        setNote('');
      }
    } catch (e: unknown) {
      toast(e instanceof Error && e.message ? e.message : 'Could not send the set to TIDAL. Check the TIDAL connection in Settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (!busy) {
      onClose();
      setNote('');
      setUnmatched(null);
    }
  };

  if (unmatched) {
    return (
      <Dialog
        open={open}
        title="Unmatched tracks"
        onClose={handleClose}
        footer={
          <button type="button" className="sn-btn sn-btn--primary" onClick={handleClose}>
            Close
          </button>
        }
      >
        <p>The following tracks could not be found on TIDAL:</p>
        <ul style={{ margin: 'var(--space-3) 0', paddingLeft: 'var(--space-4)' }}>
          {unmatched.map(t => (
            <li key={t.position}>
              {t.position}. {t.artist} - {t.title}
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  const generatedName = playlistName(new Date(), set.name);

  return (
    <Dialog
      open={open}
      title="Send to TIDAL"
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="sn-btn" onClick={handleClose} >Cancel</button>
          <button type="button" className="sn-btn sn-btn--primary" onClick={handleSend} >
            {busy ? 'Sending...' : 'Send to TIDAL'}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 'var(--space-4)' }}>
        This will create a new playlist in TIDAL named <strong>{generatedName}</strong> with {set.tracks.length} tracks in play order.
      </p>

      <TextField
        label="Note (optional)"
        help="Becomes the playlist description."
        value={note}
        onChange={setNote}
        /* disabled isn't in TextFieldProps */

      />
    </Dialog>
  );
};
