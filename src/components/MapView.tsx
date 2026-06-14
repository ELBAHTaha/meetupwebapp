import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/cn';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  colorHex: string;
  active?: boolean;
  onClick?: () => void;
}

// Small, refined circular marker — muted category color, white ring.
function pinIcon(colorHex: string, active?: boolean): L.DivIcon {
  const size = active ? 24 : 16;
  return L.divIcon({
    className: 'jmaa-pin',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${colorHex};
        border:${active ? 3 : 2.5}px solid #fff;
        border-radius:9999px;
        box-shadow:0 2px 6px rgba(43,38,32,.35);
      "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  onPick?: (lat: number, lng: number) => void;
  pickedPoint?: { lat: number; lng: number } | null;
  className?: string;
  interactive?: boolean;
}

export function MapView({
  center,
  zoom = 12,
  markers = [],
  onPick,
  pickedPoint,
  className,
  interactive = true,
}: Props) {
  // Re-center key so the map jumps when the city changes.
  const mapKey = useMemo(() => `${center.lat.toFixed(3)}-${center.lng.toFixed(3)}-${zoom}`, [center, zoom]);

  return (
    <div className={cn('overflow-hidden', className)}>
      <MapContainer
        key={mapKey}
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        zoomControl={interactive}
        doubleClickZoom={interactive}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {onPick && <ClickHandler onPick={onPick} />}
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={pinIcon(m.colorHex, m.active)}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          />
        ))}
        {pickedPoint && (
          <Marker position={[pickedPoint.lat, pickedPoint.lng]} icon={pinIcon('#C2502E', true)} />
        )}
      </MapContainer>
    </div>
  );
}
