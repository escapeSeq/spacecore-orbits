import React, { useEffect, useState } from 'react';

/** Local video under public/, or set REACT_APP_INSTRUCTIONS_VIDEO_URL for a remote file/YouTube embed. */
const INSTRUCTIONS_VIDEO_URL =
  process.env.REACT_APP_INSTRUCTIONS_VIDEO_URL || `${process.env.PUBLIC_URL || ''}/videos/instructions.mp4`;

function toEmbedUrl(url) {
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  return url;
}

const instructionsEmbedUrl = toEmbedUrl(INSTRUCTIONS_VIDEO_URL);
const isYouTube = /youtube\.com\/embed\//i.test(instructionsEmbedUrl);

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 10.5l7-4M8.5 13.5l7 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function getInstructionsShareUrl() {
  const url = new URL(window.location.href);
  url.hash = 'instructions';
  return url.toString();
}

function InstructionsModal({ open, onClose }) {
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!shareStatus) return undefined;
    const id = setTimeout(() => setShareStatus(''), 2000);
    return () => clearTimeout(id);
  }, [shareStatus]);

  if (!open) return null;

  const handleShare = async () => {
    const shareUrl = getInstructionsShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Spacecore Orbits — Instructions',
          text: 'Watch the Spacecore Orbits instructions video',
          url: shareUrl,
        });
        setShareStatus('Shared');
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareStatus('Link copied');
    } catch {
      setShareStatus('Could not copy link');
    }
  };

  return (
    <div className="instructions-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="instructions-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="instructions-modal-header">
          <h3 id="instructions-modal-title">Instructions</h3>
          <div className="instructions-modal-actions">
            <button
              type="button"
              className="instructions-share-btn"
              onClick={handleShare}
              aria-label="Share link to this video"
              title="Share link to this video"
            >
              <ShareIcon />
              {shareStatus ? <span className="instructions-share-status">{shareStatus}</span> : null}
            </button>
            <button
              type="button"
              className="instructions-close-btn"
              onClick={onClose}
              aria-label="Close instructions"
            >
              ×
            </button>
          </div>
        </div>
        <div className="instructions-video-wrap">
          {isYouTube ? (
            <iframe
              title="Instructions video"
              src={instructionsEmbedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video controls playsInline src={INSTRUCTIONS_VIDEO_URL}>
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>
    </div>
  );
}

export default InstructionsModal;
