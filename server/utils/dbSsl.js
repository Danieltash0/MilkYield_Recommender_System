// TLS settings for hosted MySQL, shared by the server pool and the db/ scripts.
//   DB_SSL=true      encrypt the connection and verify the server certificate
//   DB_SSL_CA=...    the provider's CA certificate (PEM), when it is not a public CA
//                    (Aiven: download ca.pem from the service page). Newlines may be
//                    written as \n so it fits in one environment variable.
// Returns undefined (no TLS) when DB_SSL is not set, as for the local Docker database.
module.exports = () => {
  if (String(process.env.DB_SSL).toLowerCase() !== 'true') return undefined;
  const ca = process.env.DB_SSL_CA;
  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    ...(ca ? { ca: ca.replace(/\n/g, '\n') } : {})
  };
};
