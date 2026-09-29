import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import { parseScanned } from '../../api/useQR';
import '../../styles/qr.css';

const NOT_OURS = 'That QR code is not a DairyDan cattle label.';

const ScanQR = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  const stop = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // Release the camera when leaving the page
  useEffect(() => stop, [stop]);

  // Returns true when the text was one of our codes (and we navigated to it)
  const open = useCallback(
    (text) => {
      const code = parseScanned(text);
      if (!code) {
        setError(NOT_OURS);
        return false;
      }
      navigate(`/qr/${code}`);
      return true;
    },
    [navigate]
  );

  const start = async () => {
    setError('');
    handledRef.current = false;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        // Decoding keeps running until the camera stops; act on the first hit only
        if (handledRef.current) return;
        if (open(result.data)) {
          handledRef.current = true;
          stop();
        }
      },
      { returnDetailedScanResult: true, preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true }
    );
    scannerRef.current = scanner;
    // Show the video area first; the scanner sizes its overlay from the visible element
    setScanning(true);
    try {
      await scanner.start();
    } catch (err) {
      stop();
      setError('Could not open the camera. Allow camera access (the page must be on HTTPS or localhost), or use a photo or the code below.');
    }
  };

  const scanFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    stop();
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      open(result.data);
    } catch (err) {
      setError('No QR code found in that image.');
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    setError('');
    open(manual);
  };

  return (
    <div className="container narrow">
      <div className="page-header">
        <div>
          <h1>Scan a cattle tag</h1>
          <p className="muted">Point the camera at an animal's QR label to open its profile.</p>
        </div>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="card">
        <div className={`qr-reader${scanning ? ' active' : ''}`}>
          <video ref={videoRef} muted playsInline />
        </div>
        <div className="card-actions">
          {scanning ? (
            <button className="btn btn-secondary" onClick={stop}>Stop camera</button>
          ) : (
            <button className="btn btn-primary" onClick={start}>Start camera</button>
          )}
          <label className="btn btn-outline file-button">
            Scan from photo
            <input type="file" accept="image/*" onChange={scanFile} />
          </label>
        </div>
      </div>

      <form className="card" onSubmit={submitManual}>
        <label htmlFor="manual-code">Or type the code printed under the QR</label>
        <div className="qr-manual">
          <input id="manual-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. aB3dE5fG7hJ9" />
          <button type="submit" className="btn btn-primary" disabled={!manual.trim()}>Open</button>
        </div>
      </form>
    </div>
  );
};

export default ScanQR;
