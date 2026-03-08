
/**
 * Generic API client for communicating with the external TokoCepat backend.
 * Uses NEXT_PUBLIC_API_BASE_URL from environment variables.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

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
