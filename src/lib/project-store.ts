import { get, set, del } from "idb-keyval";
import { useCallback, useEffect, useState } from "react";

export type SegmentStatus = "pending" | "rewriting" | "review" | "verified";

export type Segment = {
  id: number;
  original: string;
  rewritten: string;
  status: SegmentStatus;
  servedBy?: string;
};

export type Project = {
  fileName: string;
  createdAt: number;
  cover: string | null;
  stripHeadings: boolean;
  segments: Segment[];
};

const DB_KEY = "nre.project.v1";

export function useProject() {
  const [project, setProjectState] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    get<Project>(DB_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored) setProjectState(stored);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: Project | null) => {
    setProjectState(next);
    if (next) void set(DB_KEY, next);
    else void del(DB_KEY);
  }, []);

  const updateSegment = useCallback((id: number, patch: Partial<Segment>) => {
    setProjectState((prev) => {
      if (!prev) return prev;
      const next: Project = {
        ...prev,
        segments: prev.segments.map((segment) =>
          segment.id === id ? { ...segment, ...patch } : segment,
        ),
      };
      void set(DB_KEY, next);
      return next;
    });
  }, []);

  return { project, loaded, setProject: persist, updateSegment };
}
