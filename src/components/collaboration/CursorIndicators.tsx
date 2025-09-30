import React, { useEffect, useState } from 'react';

interface CursorPosition {
  x: number;
  y: number;
}

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  selection?: { start: number; end: number };
  lastSeen: number;
}

interface CursorIndicatorsProps {
  collaborators: Collaborator[];
  containerRef: React.RefObject<HTMLElement>;
}

export function CursorIndicators({ collaborators, containerRef }: CursorIndicatorsProps) {
  const [cursorPositions, setCursorPositions] = useState<Map<string, CursorPosition>>(new Map());

  useEffect(() => {
    const activeCollaborators = collaborators.filter(collab => 
      collab.cursor && Date.now() - collab.lastSeen < 5000 // Active within last 5 seconds
    );

    const positions = new Map<string, CursorPosition>();
    
    activeCollaborators.forEach(collab => {
      if (collab.cursor) {
        positions.set(collab.id, collab.cursor);
      }
    });

    setCursorPositions(positions);

    // Clear positions after 5 seconds of inactivity
    const timeout = setTimeout(() => {
      setCursorPositions(new Map());
    }, 5000);

    return () => clearTimeout(timeout);
  }, [collaborators]);

  if (!containerRef.current || cursorPositions.size === 0) {
    return null;
  }

  const containerRect = containerRef.current.getBoundingClientRect();

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {Array.from(cursorPositions.entries()).map(([userId, position]) => {
        const collaborator = collaborators.find(c => c.id === userId);
        if (!collaborator) return null;

        return (
          <div
            key={userId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: position.x - containerRect.left,
              top: position.y - containerRect.top,
            }}
          >
            {/* Cursor */}
            <div
              className="w-4 h-4 transform -translate-x-1 -translate-y-1"
              style={{ color: collaborator.color }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-full h-full drop-shadow-sm"
              >
                <path d="M12 2L2 7L12 12L17 7L12 2Z" />
              </svg>
            </div>

            {/* User label */}
            <div
              className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium text-white shadow-sm whitespace-nowrap"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
