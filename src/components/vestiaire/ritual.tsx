import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function StreakPill({ count }: { count: number }) {
  const label = count >= 1 ? `${count} jour${count > 1 ? "s" : ""} d'affilée` : "Historique";
  return (
    <Link to="/historique" className="streak-pill inline-flex min-h-11 items-center">
      {label}
    </Link>
  );
}

export function SwipeCard({
  children,
  onLike,
  onNext,
}: {
  children: ReactNode;
  onLike: () => void;
  onNext: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [like, setLike] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a, input, summary, label")) return;
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(y) > Math.abs(x) + 8) return;
    const next = Math.max(-140, Math.min(140, x));
    dxRef.current = next;
    setDx(next);
  }
  function up() {
    if (!start.current) return;
    const travel = dxRef.current;
    start.current = null;
    dxRef.current = 0;
    if (travel > 72) {
      setLike(true);
      setDx(0);
      onLike();
      window.setTimeout(() => setLike(false), 700);
      return;
    }
    if (travel < -72) {
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        setDx(0);
        onNext();
      }, 220);
      return;
    }
    setDx(0);
  }

  return (
    <div
      className={cn("swipe-card relative", leaving && "swipe-leave", like && "swipe-liked")}
      style={leaving ? undefined : { transform: `translateX(${dx}px) rotate(${dx / 32}deg)` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {dx > 36 && <span className="swipe-stamp swipe-like">J'aime</span>}
      {dx < -36 && <span className="swipe-stamp swipe-next">Autre</span>}
      {like && (
        <span className="like-burst" aria-hidden>
          ♥
        </span>
      )}
      {children}
    </div>
  );
}

export function WearNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="celebrate" role="status">
      <svg className="celebrate-mark" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="26" />
        <path d="M22 33.5 29 40.5 44 24" />
      </svg>
      <p>Noté. Belle journée.</p>
    </div>
  );
}
