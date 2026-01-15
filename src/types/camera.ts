/**
 * Camera type definitions for unified camera handling
 */

export type CameraType = 'SPEED_CAM' | 'RED_LIGHT_CAM' | 'POLICE_POST';
export type CameraSource = 'OFFICIAL' | 'OSM' | 'USER';

export interface CameraNode {
    id: string;
    lat: number;
    lng: number;
    type: CameraType;
    limit?: number | null;
    source: CameraSource;
    name?: string;
    city?: string;
    direction?: number; // For OSM cameras with direction tag
}

// Raw format from official_cameras.json
export interface OfficialCameraRaw {
    id: string;
    city: string;
    name: string;
    type: 'SPEED_CAM' | 'RED_LIGHT_CAM' | 'POLICE_POST';
    speed_limit: number | null;
    lat: number;
    lng: number;
}
