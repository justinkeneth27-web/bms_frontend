import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { BarangayName, EvacuationCenter, Household } from '../types';
import { BARANGAY_CONFIG } from '../data/initialData';

interface InteractiveMapProps {
  barangay: BarangayName;
  households?: Household[];
  centers?: EvacuationCenter[];
  mode?: 'dashboard' | 'pin-picker';
  selectedLocation?: { lat: number; lng: number };
  onSelectLocation?: (location: { lat: number; lng: number }) => void;
  onSelectHousehold?: (household: Household) => void;
  onAssignCenter?: (household: Household) => void;
  highlightHouseholdId?: string;
  className?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  barangay,
  households = [],
  centers = [],
  mode = 'dashboard',
  selectedLocation,
  onSelectLocation,
  onSelectHousehold,
  onAssignCenter,
  highlightHouseholdId,
  className = 'h-[360px] w-full',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up if map already attached
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const config = BARANGAY_CONFIG[barangay] || BARANGAY_CONFIG.Buang;
    const initialCenter = selectedLocation || config.center;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // In pin-picker mode, handle map clicks
    if (mode === 'pin-picker') {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (onSelectLocation) {
          onSelectLocation({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
        }
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [barangay, mode]);

  // Update center when barangay changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const config = BARANGAY_CONFIG[barangay] || BARANGAY_CONFIG.Buang;
    mapInstanceRef.current.panTo([config.center.lat, config.center.lng]);
  }, [barangay]);

  // Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    // Custom Icon Creators
    const createHouseholdIcon = (status: 'EMERGENCY' | 'MODERATE' | 'SAFE', isHighlighted: boolean) => {
      let bg = '#16a34a'; // Green
      let text = 'SAFE';
      let ringAnimation = '';

      if (status === 'EMERGENCY') {
        bg = '#dc2626'; // Red
        text = 'EVAC';
        ringAnimation = `<div class="absolute -inset-2 rounded-full border-2 border-red-500 animate-ping opacity-75"></div>`;
      } else if (status === 'MODERATE') {
        bg = '#d97706'; // Amber/Yellow
        text = 'HELP';
        ringAnimation = `<div class="absolute -inset-1 rounded-full border border-amber-400 animate-pulse"></div>`;
      }

      const highlightRing = isHighlighted ? 'ring-4 ring-blue-500 scale-110' : 'ring-2 ring-white';

      const html = `
        <div class="relative flex items-center justify-center transition-transform hover:scale-125 cursor-pointer">
          ${ringAnimation}
          <div style="background-color: ${bg};" class="w-8 h-8 rounded-full flex flex-col items-center justify-center shadow-lg text-white font-bold text-[9px] leading-none ${highlightRing}">
            <span>${text}</span>
            <div class="w-2 h-2 absolute -bottom-1 rotate-45" style="background-color: ${bg};"></div>
          </div>
        </div>
      `;

      return L.divIcon({
        className: 'custom-map-pin',
        html,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });
    };

    const createCenterIcon = (name: string, assigned: number, capacity: number) => {
      const isFull = assigned >= capacity;
      const bg = isFull ? '#7f1d1d' : '#2563eb';

      const html = `
        <div class="relative flex items-center justify-center transition-transform hover:scale-110 cursor-pointer">
          <div style="background-color: ${bg};" class="px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-xl text-white font-semibold text-[10px] ring-2 ring-white border border-blue-200">
            <span class="text-xs">🏢</span>
            <div class="flex flex-col text-left leading-tight">
              <span class="font-bold truncate max-w-[90px]">${name}</span>
              <span class="text-[9px] text-blue-100">${assigned}/${capacity} Families</span>
            </div>
          </div>
        </div>
      `;

      return L.divIcon({
        className: 'custom-center-pin',
        html,
        iconSize: [110, 36],
        iconAnchor: [55, 36],
        popupAnchor: [0, -36],
      });
    };

    if (mode === 'dashboard') {
      // Add Evacuation Centers
      centers.forEach((center) => {
        const liveAssigned = households.filter((h) => h.evacuationCenterId === center.id).length;
        const assigned = households.length > 0 ? liveAssigned : (center.assignedCount ?? 0);
        const marker = L.marker([center.location.lat, center.location.lng], {
          icon: createCenterIcon(center.name, assigned, center.capacityFamilies),
        });

        const popupContent = document.createElement('div');
        popupContent.className = 'p-2 text-slate-800 text-xs font-sans min-w-[200px]';
        popupContent.innerHTML = `
          <div class="font-bold text-sm text-blue-700 mb-1 flex items-center gap-1">
            <span>🏢</span> ${center.name}
          </div>
          <div class="text-slate-600 mb-1"><strong>Barangay:</strong> ${center.barangay} (${center.purok})</div>
          <div class="text-slate-600 mb-1"><strong>Status:</strong> <span class="font-semibold ${center.status === 'Open' ? 'text-green-600' : 'text-red-600'}">${center.status}</span></div>
          <div class="text-slate-600 mb-1"><strong>Capacity:</strong> ${assigned} / ${center.capacityFamilies} Families</div>
          <div class="text-slate-600 mb-2"><strong>Contact:</strong> ${center.managerName} (${center.managerContact})</div>
          <div class="text-[10px] text-slate-500 bg-slate-100 p-1.5 rounded">
            <strong>Facilities:</strong> ${center.facilities.join(', ')}
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(markersGroup);
      });

      // Add Households
      households.forEach((hh) => {
        const isHighlighted = hh.id === highlightHouseholdId;
        const marker = L.marker([hh.location.lat, hh.location.lng], {
          icon: createHouseholdIcon(hh.status, isHighlighted),
          zIndexOffset: hh.status === 'EMERGENCY' ? 1000 : 100,
        });

        const statusColor = hh.status === 'EMERGENCY' ? 'text-red-600 bg-red-50 border-red-200' : hh.status === 'MODERATE' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-green-700 bg-green-50 border-green-200';
        const statusLabel = hh.status === 'EMERGENCY' ? '🚨 MUST EVACUATE' : hh.status === 'MODERATE' ? '⚠️ MODERATE / NEED HELP' : '✅ SAFE AT HOME';

        const popupContent = document.createElement('div');
        popupContent.className = 'p-1 text-slate-800 text-xs font-sans min-w-[240px]';
        popupContent.innerHTML = `
          <div class="font-bold text-sm text-slate-900 border-b pb-1.5 mb-1.5 flex items-center justify-between cursor-pointer" id="popup-title-${hh.id}">
            <span class="text-blue-700 hover:underline flex items-center gap-1 font-bold">👤 ${hh.headOfFamily}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold border ${statusColor}">${statusLabel}</span>
          </div>
          <div class="space-y-1 mb-2 text-slate-600 text-xs">
            <div class="flex items-center gap-1"><strong>Purok:</strong> <span class="bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-800">${hh.purok}</span>, Brgy. ${hh.barangay}</div>
            <div><strong>Contact:</strong> <a href="tel:${hh.contactNumber}" class="text-blue-600 font-mono font-bold hover:underline">${hh.contactNumber}</a></div>
            <div><strong>Members:</strong> <span class="font-bold text-slate-900">${hh.numberOfMembers} Person(s)</span></div>
            ${hh.specialNeeds.length > 0 ? `<div><strong>Vulnerable:</strong> <span class="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">${hh.specialNeeds.join(', ')}</span></div>` : ''}
            ${hh.statusNote ? `<div class="bg-red-50 p-1.5 rounded text-[11px] text-red-800 font-medium border border-red-200"><strong>Report:</strong> "${hh.statusNote}"</div>` : ''}
          </div>
          <div class="flex gap-1.5 mt-2 pt-1.5 border-t">
            <button id="view-hh-${hh.id}" class="flex-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold text-center transition cursor-pointer shadow-xs">View Full Profile</button>
            <button id="assign-hh-${hh.id}" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold text-center transition cursor-pointer shadow-xs">Assign Shelter</button>
          </div>
        `;

        // Direct click on marker opens details modal
        marker.on('click', () => {
          if (onSelectHousehold) {
            onSelectHousehold(hh);
          }
        });

        // Wire popup button events
        marker.on('popupopen', () => {
          const titleEl = document.getElementById(`popup-title-${hh.id}`);
          if (titleEl && onSelectHousehold) {
            titleEl.onclick = () => onSelectHousehold(hh);
          }
          const viewBtn = document.getElementById(`view-hh-${hh.id}`);
          if (viewBtn && onSelectHousehold) {
            viewBtn.onclick = () => onSelectHousehold(hh);
          }
          const assignBtn = document.getElementById(`assign-hh-${hh.id}`);
          if (assignBtn && onAssignCenter) {
            assignBtn.onclick = () => onAssignCenter(hh);
          }
        });

        marker.addTo(markersGroup);
      });
    }

    // Pin Picker Mode
    if (mode === 'pin-picker' && selectedLocation) {
      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.remove();
      }

      const pickerIcon = L.divIcon({
        className: 'custom-picker-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl ring-4 ring-white border-2 border-indigo-700 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="w-2.5 h-2.5 bg-indigo-900 rounded-full absolute -bottom-1"></div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

      const pickerMarker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        icon: pickerIcon,
        draggable: true,
      }).addTo(markersGroup);

      pickerMarker.on('dragend', (e: L.DragEndEvent) => {
        const marker = e.target;
        const position = marker.getLatLng();
        if (onSelectLocation) {
          onSelectLocation({
            lat: Number(position.lat.toFixed(6)),
            lng: Number(position.lng.toFixed(6)),
          });
        }
      });

      pickerMarker.bindPopup(`
        <div class="text-xs p-1 text-slate-800">
          <strong class="text-indigo-600">Selected Household Pin</strong><br/>
          Lat: ${selectedLocation.lat}<br/>
          Lng: ${selectedLocation.lng}<br/>
          <span class="text-[10px] text-slate-500">Drag pin or click map to reposition.</span>
        </div>
      `).openPopup();

      pickerMarkerRef.current = pickerMarker;
    }
  }, [households, centers, mode, selectedLocation, highlightHouseholdId, onSelectHousehold, onAssignCenter, onSelectLocation]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 isolate z-0">
      <div ref={mapContainerRef} className={className} />
      
      {/* Map Control Legend Overlay */}
      {mode === 'dashboard' && (
        <div className="absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md border border-slate-200 text-[11px] flex flex-wrap items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-ping inline-block" style={{ animationDuration: '2s' }}></span>
            <span className="font-semibold text-red-700">Must Evacuate (Emergency)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="font-semibold text-amber-700">Moderate Alert</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
            <span className="font-semibold text-emerald-700">Safe at Home</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs">🏢</span>
            <span className="font-semibold text-blue-700">Evac Center</span>
          </div>
        </div>
      )}

      {mode === 'pin-picker' && (
        <div className="absolute top-2 right-2 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow border border-slate-200 text-xs text-slate-700 pointer-events-auto">
          💡 Click on map or drag purple marker to pin home location
        </div>
      )}
    </div>
  );
};
