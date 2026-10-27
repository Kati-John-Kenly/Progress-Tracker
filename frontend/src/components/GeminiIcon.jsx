import { useId } from 'react';

export default function GeminiIcon({ size = 20, className = '', color }) {
    const id = useId();
    const gradId = `gemini-sparkle-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
        >
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--gemini-sparkle-1, #4e8cff)" />
                    <stop offset="45%" stopColor="var(--gemini-sparkle-2, #9b72cb)" />
                    <stop offset="90%" stopColor="var(--gemini-sparkle-3, #f43f5e)" />
                </linearGradient>
            </defs>
            <path
                d="M12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24Z"
                fill={color || `url(#${gradId})`}
            />
        </svg>
    );
}
