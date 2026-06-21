import React, { useRef, useState, useEffect } from 'react';
import { Target, HelpCircle } from 'lucide-react';

interface StyleJoystickProps {
  onStyleBlend: (blendDescription: string, blendRules: string) => void;
}

export default function StyleJoystick({ onStyleBlend }: StyleJoystickProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // -100 to 100
  const [isDragging, setIsDragging] = useState(false);

  // Derive styles and rules based on 2D coordinates
  useEffect(() => {
    // X-axis: Ambient Folk (-100) vs. Cyber Glitch/Industrial (+100)
    // Y-axis: Autopsy Cool/Detached (-100) vs. Radioactive Frenzy/Intensity (+100)
    const { x, y } = position;
    
    let styleTerm = "";
    let rulesText = "";

    if (x >= 0 && y >= 0) {
      styleTerm = `Radioactive Cyber-Synthwave (Manic Glitch Blend)`;
      rulesText = `BLENDED STYLE: Hyper-manic, screaming, high-gloss electronic cyberwave. 
FOCUS: Manic digital repetition, voltage, fragmented sentences, internet-speak, neon overload, and mechanical submission rules. 
INTENSITY: Edge-of-breakdown, radioactive emotional levels.`;
    } else if (x < 0 && y >= 0) {
      styleTerm = `Radioactive Neo-Folk (Manic Organic Blend)`;
      rulesText = `BLENDED STYLE: Manic acoustic folk/grunge. 
FOCUS: Fast-verbal sensory density, raw basement dirt, ancient spirits, raw frustration, slurred lyrics, loud-quiet dynamics, and visceral emotional pressure.
INTENSITY: Haunting, spiritual, and hyper-dense poetic frenzy.`;
    } else if (x >= 0 && y < 0) {
      styleTerm = `Automated Autopsy (Detached Industrial Wave)`;
      rulesText = `BLENDED STYLE: Autopsy-cool detached industrial. 
FOCUS: Concrete, metal, mechanical cables, submission to networks, and terminal clinical imagery.
INTENSITY: Sub-zero, deadpan, zero self-pity, high robotic precision.`;
    } else {
      styleTerm = `Sub-Zero Gothic Folk (Detached Plainspoken Portrait)`;
      rulesText = `BLENDED STYLE: Restrained, cold-wave indie folk. 
FOCUS: Mundane concrete detail, bone-white light, winter scenery, unvarnished simple plainspoken lyrics, and slow-pulse delivery.
INTENSITY: Autopsy-like clinical detachment applied to tender folk storytelling.`;
    }

    const blendExplanation = `Coordinates: [X: ${x}%, Y: ${y}%] — Dynamic Blend of ${styleTerm}`;
    onStyleBlend(blendExplanation, rulesText);
  }, [position, onStyleBlend]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updatePosition(e);
    if (padRef.current) {
      padRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if (padRef.current) {
      padRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const updatePosition = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    
    // Scale to -100 to 100
    const rawX = ((e.clientX - rect.left) / rect.width) * 200 - 100;
    const rawY = -(((e.clientY - rect.top) / rect.height) * 200 - 100); // Invert Y-axis

    const x = Math.max(-100, Math.min(100, Math.round(rawX)));
    const y = Math.max(-100, Math.min(100, Math.round(rawY)));

    setPosition({ x, y });
  };

  return (
    <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-inner">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-indigo-400" />
          2D Dynamic Style-Blending Joystick
        </label>
        <span className="text-[8px] text-zinc-500 font-mono">
          X: {position.x}% | Y: {position.y}%
        </span>
      </div>

      {/* The Pad Container */}
      <div 
        ref={padRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-44 w-full bg-zinc-950/80 border border-zinc-805/80 rounded-xl cursor-crosshair overflow-hidden touch-none select-none select-text"
        id="style-joystick-pad"
      >
        {/* Radar grids */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <div className="border-r border-b border-zinc-900 border-dashed" />
          <div className="border-b border-zinc-900 border-dashed" />
          <div className="border-r border-zinc-900 border-dashed" />
          <div className="border-zinc-900 border-dashed" />
        </div>

        {/* Diagonal axis labels */}
        <div className="absolute top-2 left-3 text-[7.5px] font-black text-zinc-600 uppercase tracking-wider">
          Manic Organic
        </div>
        <div className="absolute top-2 right-3 text-[7.5px] font-black text-zinc-600 uppercase tracking-wider">
          Manic Electronic
        </div>
        <div className="absolute bottom-2 left-3 text-[7.5px] font-black text-zinc-600 uppercase tracking-wider">
          Detached Organic
        </div>
        <div className="absolute bottom-2 right-3 text-[7.5px] font-black text-zinc-600 uppercase tracking-wider">
          Detached Electronic
        </div>

        {/* Center Target Marker */}
        <div 
          className="absolute w-2 h-2 bg-zinc-800 rounded-full"
          style={{ left: 'calc(50% - 4px)', top: 'calc(50% - 4px)' }}
        />

        {/* Interactive Joystick Dot */}
        <div 
          className="absolute w-7 h-7 rounded-full bg-indigo-500/20 border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] flex items-center justify-center transition-all duration-75 pointer-events-none"
          style={{ 
            left: `calc(${50 + position.x / 2}% - 14px)`,
            top: `calc(${50 - position.y / 2}% - 14px)`
          }}
        >
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
        </div>
      </div>

      <div className="text-[8.5px] text-zinc-500 leading-relaxed font-sans italic max-w-md">
        Drag the coordinate target around the matrix board. Dragging instantly blends the style lane and intensity constraints inside the generator prompt.
      </div>
    </div>
  );
}
