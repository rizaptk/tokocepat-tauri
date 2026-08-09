
/**
 * Generic API client for communicating with the external TokoCepat backend.
 * Uses VITE_API_BASE_URL from environment variables.
 */

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'https://tokocepat-three.vercel.app';

export async function apiFetch(path: string, options: RequestInit = {}) {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    return response;
}
