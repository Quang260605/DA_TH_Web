const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.trim();

export const BACKEND_URL = (configuredBackendUrl || 'http://localhost:5058').replace(/\/$/, '');
export const API_URL = `${BACKEND_URL}/api`;
