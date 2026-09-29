import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAllQR, qrLink } from '../../api/useQR';
import Loader from '../../components/Loader';
import '../../styles/qr.css';

// Printable label sheet. ?cattle=3 prints a single animal's label.
const QRLabels = () => {
  const { codes, loading, error, generateMissing } = useAllQR();
  const [params] = useSearchParams();
  const only = params.get('cattle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const labels = only ? codes.filter((q) => String(q.cattle_id) === only) : codes;

  const fillGaps = async () => {
    setBusy(true);
    const result = await generateMissing();
    setBusy(false);
    setMessage(
      result.success
        ? result.data.created
          ? `Generated ${result.data.created} new label${result.data.created === 1 ? '' : 's'}.`
          : 'Every animal already has a label.'
        : result.error
    );
  };

  if (loading) return <Loader />;

  return (
    <div className="container">
      <div className="page-header no-print">
        <div>
          <h1>QR labels</h1>
          <p className="muted">{labels.length} label{labels.length === 1 ? '' : 's'} · print on sticker paper or card</p>
        </div>
        <div className="card-actions">
          {only ? (
            <Link to="/qr/labels" className="btn btn-outline">All labels</Link>
          ) : (
            <button className="btn btn-outline" onClick={fillGaps} disabled={busy}>
              {busy ? 'Generating…' : 'Generate missing'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!labels.length}>Print</button>
        </div>
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}
      {message && <div className="alert alert-success no-print">{message}</div>}

      {labels.length === 0 ? (
        <div className="card empty no-print"><p>No labels yet. Use “Generate missing” to create them.</p></div>
      ) : (
        <div className="label-sheet">
          {labels.map((q) => (
            <div className="qr-label" key={q.qr_id}>
              <QRCodeSVG value={qrLink(q.code)} size={132} level="M" marginSize={1} />
              <div className="qr-label-text">
                <strong>{q.cattle_name || 'Unnamed'}</strong>
                <span>Tag {q.cattle_tag}</span>
                <span className="mono">{q.code}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QRLabels;
