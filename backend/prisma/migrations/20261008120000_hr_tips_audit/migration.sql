-- Preserve historic audit timestamps; old cancellations retain their timestamp-based report date.
ALTER TABLE "TipAllocation" ADD COLUMN "cancellationDate" DATE;
