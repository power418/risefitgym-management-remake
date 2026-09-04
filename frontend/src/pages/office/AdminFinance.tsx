import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/helpers/api-error"
import {
  createFinanceTransaction,
  deleteFinanceTransaction,
  listFinanceTransactions,
  updateFinanceTransaction,
  type FinanceTransaction,
} from "@/services/admin"
import { CreditCard, Pencil, Plus, Receipt, RefreshCcw, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const PG_INT_MAX = 2_147_483_647

function formatCurrencyIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function AdminFinanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminFinance() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null)
  const [form, setForm] = useState({
    description: "",
    amount: "",
    occurredAt: "",
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listFinanceTransactions()
        if (cancelled) return
        setTransactions(result.transactions)
        setTotalIncome(result.totalIncome)
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return transactions
    return transactions.filter((t) => t.description.toLowerCase().includes(q))
  }, [transactions, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))

  useEffect(() => {
    setCurrentPage(1)
  }, [query])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const currentTransactions = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  function openCreateSheet() {
    setMessage(null)
    setError(null)
    setEditingTransaction(null)
    setForm({ description: "", amount: "", occurredAt: "" })
    setSheetOpen(true)
  }

  function openEditSheet(tx: FinanceTransaction) {
    setMessage(null)
    setError(null)
    setEditingTransaction(tx)
    setForm({
      description: tx.description,
      amount: String(tx.amount),
      occurredAt: tx.occurredAt.slice(0, 10),
    })
    setSheetOpen(true)
  }

  async function refresh() {
    setIsRefreshing(true)
    setError(null)
    try {
      const result = await listFinanceTransactions()
      setTransactions(result.transactions)
      setTotalIncome(result.totalIncome)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    setMessage(null)

    const description = form.description.trim()
    const amount = Number.parseInt(form.amount, 10)
    const occurredAt = form.occurredAt.trim()

    if (!description) {
      setError("Deskripsi wajib diisi.")
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(amount) || !Number.isSafeInteger(amount) || amount < 0) {
      setError("Jumlah harus berupa angka >= 0.")
      setSubmitting(false)
      return
    }

    if (amount > PG_INT_MAX) {
      setError(`Jumlah maksimal adalah ${PG_INT_MAX}.`)
      setSubmitting(false)
      return
    }

    if (!occurredAt) {
      setError("Tanggal wajib diisi.")
      setSubmitting(false)
      return
    }

    try {
      if (!editingTransaction) {
        const created = await createFinanceTransaction({ description, amount, occurredAt })
        setTransactions((prev) => [created, ...prev].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)))
        setTotalIncome((prev) => prev + created.amount)
        setMessage("Transaksi berhasil ditambahkan.")
        setSheetOpen(false)
        return
      }

      const patch: Parameters<typeof updateFinanceTransaction>[1] = {}
      if (description !== editingTransaction.description) patch.description = description
      if (amount !== editingTransaction.amount) patch.amount = amount
      if (occurredAt !== editingTransaction.occurredAt.slice(0, 10)) patch.occurredAt = occurredAt

      if (!Object.keys(patch).length) {
        setMessage("Tidak ada perubahan.")
        setSheetOpen(false)
        return
      }

      const updated = await updateFinanceTransaction(editingTransaction.id, patch)
      setTransactions((prev) =>
        prev
          .map((t) => (t.id === updated.id ? updated : t))
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      )
      setTotalIncome((prev) => prev - editingTransaction.amount + updated.amount)
      setMessage("Transaksi berhasil diperbarui.")
      setSheetOpen(false)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(tx: FinanceTransaction) {
    const ok = window.confirm(`Hapus transaksi "${tx.description}"?`)
    if (!ok) return

    setDeletingId(tx.id)
    setError(null)
    setMessage(null)
    try {
      await deleteFinanceTransaction(tx.id)
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id))
      setTotalIncome((prev) => prev - tx.amount)
      setMessage("Transaksi berhasil dihapus.")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <AdminFinanceSkeleton />

  const showingStart = filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const showingEnd = Math.min(currentPage * itemsPerPage, filtered.length)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin Finance</h1>
        <p className="text-muted-foreground text-sm">
          Riwayat pemasukan + modul invoice & pembayaran.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert>
          <AlertTitle>Info</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Faktur & Tagihan (Invoice)</CardTitle>
              <CardDescription>
                Penerbitan faktur tagihan transaksi membership dan pemesanan produk.
              </CardDescription>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Receipt className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                Sistem Otomatis Aktif
              </Badge>
              <Badge variant="outline" className="text-xs">
                Faktur Digital
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Setiap transaksi yang dibuat oleh member otomatis menghasilkan invoice digital resmi beserta nomor transaksi unik.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Gerbang Pembayaran (Midtrans)</CardTitle>
              <CardDescription>
                Integrasi pembayaran multi-channel otomatis dan instan.
              </CardDescription>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <CreditCard className="size-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs">
                Gateway Terhubung
              </Badge>
              <Badge variant="outline" className="text-xs">
                QRIS & Virtual Account
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mendukung verifikasi pembayaran instan tanpa konfirmasi manual melalui webhook notifikasi resmi.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>History Pemasukan</CardTitle>
              <CardDescription>
                Catatan transaksi pemasukan manual (deskripsi, jumlah, tanggal) seperti di workspace lama.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Badge variant="secondary" className="w-fit bg-primary/10 text-primary">
                Total: {formatCurrencyIdr(totalIncome)}
              </Badge>
              <div className="w-full sm:w-64">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari deskripsi..."
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={isRefreshing || submitting || Boolean(deletingId)}
              >
                <RefreshCcw className="size-4" />
                {isRefreshing ? "Memuat..." : "Refresh"}
              </Button>
              <Button size="sm" onClick={openCreateSheet} disabled={submitting || Boolean(deletingId)}>
                <Plus className="size-4" />
                Tambah
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto rounded-xl border bg-background">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                  <th className="w-16">No</th>
                  <th>Deskripsi</th>
                  <th className="w-48">Jumlah</th>
                  <th className="w-40">Tanggal</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentTransactions.length ? (
                  currentTransactions.map((tx, index) => {
                    const isDeleting = deletingId === tx.id
                    return (
                      <tr key={tx.id} className="[&>td]:px-4 [&>td]:py-3">
                        <td className="text-muted-foreground">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="font-medium">{tx.description}</td>
                        <td className="whitespace-nowrap font-semibold">{formatCurrencyIdr(tx.amount)}</td>
                        <td className="whitespace-nowrap">{tx.occurredAt.slice(0, 10)}</td>
                        <td className="whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() => openEditSheet(tx)}
                              disabled={submitting || Boolean(deletingId)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => handleDelete(tx)}
                              disabled={submitting || Boolean(deletingId)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                          {isDeleting ? (
                            <p className="mt-1 text-right text-xs text-muted-foreground">Menghapus...</p>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Tidak ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm">
              Showing{" "}
              <span className="text-foreground font-medium">{showingStart}</span> to{" "}
              <span className="text-foreground font-medium">{showingEnd}</span> of{" "}
              <span className="text-foreground font-medium">{filtered.length}</span> results
            </p>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                &lt;
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="xs"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                &gt;
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingTransaction(null)
        }}
      >
        <SheetContent className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle>{editingTransaction ? "Edit Transaksi" : "Tambah Transaksi"}</SheetTitle>
            <SheetDescription>
              {editingTransaction
                ? "Ubah deskripsi, jumlah, atau tanggal transaksi."
                : "Tambahkan transaksi pemasukan baru."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Contoh: Pemasukan membership"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="amount">Jumlah</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                max={PG_INT_MAX}
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="occurredAt">Tanggal</Label>
              <Input
                id="occurredAt"
                type="date"
                value={form.occurredAt}
                onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-auto">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
