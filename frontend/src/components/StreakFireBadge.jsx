import React from 'react';

export default function StreakFireBadge({ streak = 0, onClick }) {
    return (
        <button
            type="button"
            className="streak-fire-btn"
            onClick={onClick}
            title={`Consistency Streak: ${streak} days. Tap to open Consistency Calendar`}
            aria-label={`Consistency Streak: ${streak} days`}
        >
            <div className="streak-fire-wrap">
                <svg
                    viewBox="0 0 36 44"
                    width="34"
                    height="42"
                    className="streak-fire-svg animated-fire"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        {/* Outer Flame Gradient */}
                        <linearGradient id="streak-outer-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#b91c1c" />
                            <stop offset="30%" stopColor="#ea580c" />
                            <stop offset="70%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#facc15" />
                        </linearGradient>

                        {/* Mid Flame Gradient */}
                        <linearGradient id="streak-mid-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#ea580c" />
                            <stop offset="50%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#fef08a" />
                        </linearGradient>

                        {/* Core Hot White-Yellow Gradient */}
                        <linearGradient id="streak-core-grad" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
                            <stop offset="55%" stopColor="#fef08a" stopOpacity="0.95" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                        </linearGradient>

                        {/* Ambient Fire Aura Glow */}
                        <filter id="streak-fire-glow-rich" x="-30%" y="-30%" width="160%" height="160%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#f97316" floodOpacity="0.75" />
                        </filter>
                    </defs>

                    {/* Rising Ember Sparks */}
                    <circle cx="14" cy="10" r="1.4" fill="#fef08a" className="streak-fire-spark s1" />
                    <circle cx="21" cy="7" r="1.1" fill="#facc15" className="streak-fire-spark s2" />
                    <circle cx="18" cy="4" r="1.3" fill="#ffffff" className="streak-fire-spark s3" />

                    {/* Main Outer Flame */}
                    <path
                        className="streak-flame-outer"
                        d="M18 2 C18 2 23 8.5 23 14 C23 10.5 26 11 27 13.5 C29.5 17 30.5 21 30.5 26 C30.5 34.5 25 41 18 41 C11 41 5.5 34.5 5.5 26 C5.5 19 9.5 14 13 11 C13 15 15.5 16.5 17.5 15 C17.5 10 18 2 18 2 Z"
                        fill="url(#streak-outer-grad)"
                        filter="url(#streak-fire-glow-rich)"
                    />

                    {/* Secondary Mid Flame */}
                    <path
                        className="streak-flame-mid"
                        d="M18 11 C18 11 21.5 15.5 21.5 20 C21.5 17.5 23.5 18 24.5 20 C25.5 23 25.5 26 24 29 C22.5 32 20.5 34 18 34 C15.5 34 13.5 32 12 29 C10.5 26 10.5 23 11.5 20 C12.5 18 14.5 17.5 14.5 20 C14.5 15.5 18 11 18 11 Z"
                        fill="url(#streak-mid-grad)"
                    />

                    {/* Core White-Hot Flame Glow */}
                    <path
                        className="streak-flame-core"
                        d="M18 17 C18 17 20 20.5 20 23.5 C20 22 21.2 22 21.8 23.5 C22.5 26.5 21 30 18 30 C15 30 13.5 26.5 14.2 23.5 C14.8 22 16 22 16 23.5 C16 20.5 18 17 18 17 Z"
                        fill="url(#streak-core-grad)"
                    />
                </svg>

                {/* STREAK COUNT INSIDE THE ANIMATED FIRE */}
                <span className="streak-fire-count">{streak}</span>
            </div>
        </button>
    );
}

