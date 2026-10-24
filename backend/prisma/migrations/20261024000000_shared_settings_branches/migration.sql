-- CreateTable
CREATE TABLE "_TaxBranches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PaymentBranches" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TaxBranches_AB_unique" ON "_TaxBranches"("A", "B");

-- CreateIndex
CREATE INDEX "_TaxBranches_B_index" ON "_TaxBranches"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PaymentBranches_AB_unique" ON "_PaymentBranches"("A", "B");

-- CreateIndex
CREATE INDEX "_PaymentBranches_B_index" ON "_PaymentBranches"("B");

-- AddForeignKey
ALTER TABLE "_TaxBranches" ADD CONSTRAINT "_TaxBranches_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaxBranches" ADD CONSTRAINT "_TaxBranches_B_fkey" FOREIGN KEY ("B") REFERENCES "TaxRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PaymentBranches" ADD CONSTRAINT "_PaymentBranches_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PaymentBranches" ADD CONSTRAINT "_PaymentBranches_B_fkey" FOREIGN KEY ("B") REFERENCES "PaymentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "_PaymentBranches" ("A", "B") SELECT "branchId", "id" FROM "PaymentAccount" ON CONFLICT DO NOTHING;
INSERT INTO "_TaxBranches" ("A", "B") SELECT "branchId", "id" FROM "TaxRule" ON CONFLICT DO NOTHING;
