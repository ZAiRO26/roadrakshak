import { useState, useEffect, useRef, useCallback } from 'react';
import { autocomplete, parseCoordinates } from '../services/PlacesService';
import { useGpsStore } from '../stores/gpsStore';

interface SearchBarProps {
    onLocationSelect: (location: { lat: number; lng: number; name: string }) => void;
    onDirectionsClick: () => void;
}

interface Suggestion {
    place_id: string;
    description: string;
    main_text: string;
    secondary_text: string;
    lat?: number;
    lng?: number;
}

export function SearchBar({ onLocationSelect, onDirectionsClick }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { latitude, longitude } = useGpsStore();

    // Debounced search
    const handleInputChange = useCallback((value: string) => {
        setQuery(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (!value.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Check if it's coordinates
        const coords = parseCoordinates(value);
        if (coords) {
            setSuggestions([{
                place_id: 'coords',
                description: `${coords.lat}, ${coords.lng}`,
                main_text: 'Go to coordinates',
                secondary_text: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
                lat: coords.lat,
                lng: coords.lng,
            }]);
            setShowSuggestions(true);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const results = await autocomplete(
                    value,
                    latitude && longitude ? { lat: latitude, lng: longitude } : undefined
                );

                const mapped = results.map(r => ({
                    place_id: r.place_id,
                    description: r.description,
                    main_text: r.structured_formatting?.main_text || r.description.split(',')[0],
                    secondary_text: r.structured_formatting?.secondary_text || '',
                    lat: r.geometry?.location?.lat,
                    lng: r.geometry?.location?.lng,
                }));

                setSuggestions(mapped);
                setShowSuggestions(mapped.length > 0);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);
    }, [latitude, longitude]);

    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.lat && suggestion.lng) {
            onLocationSelect({
                lat: suggestion.lat,
                lng: suggestion.lng,
                name: suggestion.main_text,
            });
        }
        setQuery(suggestion.main_text);
        setShowSuggestions(false);
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="search-bar-container" onClick={e => e.stopPropagation()}>
            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search location..."
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    className="search-input"
                />
                {isLoading && <span className="search-loading">⏳</span>}
                <button
                    className="directions-btn"
                    onClick={onDirectionsClick}
                    title="Get Directions"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
                    </svg>
                </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions">
                    {suggestions.map((s, i) => (
                        <div
                            key={s.place_id + i}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(s)}
                        >
                            <span className="suggestion-icon">📍</span>
                            <div className="suggestion-text">
                                <div className="suggestion-main">{s.main_text}</div>
                                {s.secondary_text && (
                                    <div className="suggestion-secondary">{s.secondary_text}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .search-bar-container {
                    position: fixed;
                    top: 16px;
                    left: 16px;
                    right: 16px;
                    z-index: 1000;
                    max-width: 600px;
                }
                .search-bar {
                    display: flex;
                    align-items: center;
                    background: white;
                    border-radius: 24px;
                    padding: 8px 16px;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
                    gap: 12px;
                }
                [data-theme="dark"] .search-bar {
                    background: rgba(30, 41, 59, 0.95);
                }
                .search-icon {
                    font-size: 18px;
                    opacity: 0.6;
                }
                .search-input {
                    flex: 1;
                    border: none;
                    outline: none;
                    font-size: 16px;
                    background: transparent;
                    color: inherit;
                }
                .search-input::placeholder {
                    color: #9ca3af;
                }
                .search-loading {
                    font-size: 16px;
                }
                .directions-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: none;
                    background: #3b82f6;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.2s, background 0.2s;
                }
                .directions-btn:hover {
                    background: #2563eb;
                    transform: scale(1.05);
                }
                .search-suggestions {
                    margin-top: 8px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                    overflow: hidden;
                    max-height: 300px;
                    overflow-y: auto;
                }
                [data-theme="dark"] .search-suggestions {
                    background: rgba(30, 41, 59, 0.98);
                }
                .suggestion-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .suggestion-item:hover {
                    background: rgba(59, 130, 246, 0.1);
                }
                .suggestion-icon {
                    font-size: 18px;
                    opacity: 0.7;
                }
                .suggestion-text {
                    flex: 1;
                    min-width: 0;
                }
                .suggestion-main {
                    font-size: 14px;
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .suggestion-secondary {
                    font-size: 12px;
                    opacity: 0.6;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </div>
    );
}
