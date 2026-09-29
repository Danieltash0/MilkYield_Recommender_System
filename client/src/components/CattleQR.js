import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useAuth, ROLES } from '../context/AuthContext';
import { getCattleQR, createCattleQR, regenerateCattleQR, qrLink } from '../api/useQR';
import Modal from './Modal';
import '../styles/qr.css';

// QR identification card shown on the cattle profile
const CattleQR = ({ cow }) => {
  const { hasRole } = useAuth();
  const canGenerate = hasRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.WORKER);
  const canReissue = hasRole(ROLES.ADMIN, ROLES.MANAGER);
  const [qr, setQr] = useState(undefined); // undefined = loading, null = none yet
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmReissue, setConfirmReissue] = useState(false);
  const canvasWrap = useRef(null);

  useEffect(() => {
    let active = true;
    getCattleQR(cow.cattle_id).then((q) => active && setQr(q));
    return () => { active = false; };
  }, [cow.cattle_id]);

  const act = async (fn) => {
    setBusy(true);
    setError('');
    const result = await fn(cow.cattle_id);
    setBusy(false);
    if (result.success) setQr(result.data);
    else setError(result.error);
    return result;
  };

  const download = () => {
    const canvas = canvasWrap.current && canvasWrap.current.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `dairydan-${cow.tag_number}.png`;
    a.click();
  };

  if (qr === undefined) return null;

  return (
    <div className="card qr-card">
      <h3>QR identification</h3>
      {error && <div className="alert alert-error">{error}</div>}

      {qr === null ? (
        <>
          <p className="muted">This animal has no QR label yet.</p>
          {canGenerate && (
            <button className="btn btn-primary" onClick={() => act(createCattleQR)} disabled={busy}>
              {busy ? 'Generating…' : 'Generate QR code'}
            </button>
          )}
        </>
      ) : (
        <div className="qr-body">
          <div className="qr-image">
            <QRCodeSVG value={qrLink(qr.code)} size={168} level="M" marginSize={2} title={`QR code for ${cow.tag_number}`} />
          </div>
          <div className="qr-info">
            <dl className="details">
              <div><dt>Code</dt><dd className="mono">{qr.code}</dd></div>
              <div><dt>Scans</dt><dd>{qr.scan_count}</dd></div>
            </dl>
            <div className="card-actions">
              <button className="btn btn-outline btn-sm" onClick={download}>Download PNG</button>
              <Link to={`/qr/labels?cattle=${cow.cattle_id}`} className="btn btn-outline btn-sm">Print label</Link>
              {canReissue && (
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmReissue(true)} disabled={busy}>Reissue</button>
              )}
            </div>
          </div>
          {/* High-resolution copy used only for the PNG download */}
          <div ref={canvasWrap} className="qr-hidden" aria-hidden="true">
            <QRCodeCanvas value={qrLink(qr.code)} size={512} level="M" marginSize={4} />
          </div>
        </div>
      )}

      {confirmReissue && (
        <Modal
          title="Reissue QR code"
          confirmText="Reissue"
          loading={busy}
          onCancel={() => setConfirmReissue(false)}
          onConfirm={async () => {
            const result = await act(regenerateCattleQR);
            if (result.success) setConfirmReissue(false);
          }}
        >
          <p>
            The current label for <strong>{cow.name || cow.tag_number}</strong> will stop working. Use this when a label is
            lost or damaged, then print the new one.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default CattleQR;
