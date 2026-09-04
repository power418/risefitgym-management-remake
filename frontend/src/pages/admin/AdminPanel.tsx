import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiErrorMessage } from "@/helpers/api-error"
import { adjustProductStock, createProduct, deleteProduct, updateProduct } from "@/services/admin"
import { listProducts, type Product } from "@/services/user"
import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

const PG_INT_MAX = 2_147_483_647

export function AdminPanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-52" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full max-w-lg" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminPanel() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    price: "",
    stock: "",
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listProducts()
        if (!cancelled) setProducts(result)
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

  function formatCurrencyIdr(amount: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filtered = query.trim()
    ? products.filter((p) => {
        const haystack = `${p.name} ${p.sku} ${p.description ?? ""}`.toLowerCase()
        return haystack.includes(query.trim().toLowerCase())
      })
    : products

  async function refreshProducts() {
    setIsRefreshing(true)
    setError(null)
    try {
      const result = await listProducts()
      setProducts(result)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsRefreshing(false)
    }
  }

  function openCreateSheet() {
    setMessage(null)
    setError(null)
    setEditingProduct(null)
    setForm({ sku: "", name: "", description: "", price: "", stock: "" })
    setSheetOpen(true)
  }

  function openEditSheet(product: Product) {
    setMessage(null)
    setError(null)
    setEditingProduct(product)
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      price: String(product.price),
      stock: String(product.stock),
    })
    setSheetOpen(true)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    setMessage(null)

    const name = form.name.trim()
    const sku = form.sku.trim()
    const description = form.description.trim()

    const price = Number.parseInt(form.price, 10)
    const stock = Number.parseInt(form.stock, 10)

    if (!name) {
      setError("Nama barang wajib diisi.")
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(price) || !Number.isSafeInteger(price) || price < 0) {
      setError("Harga harus berupa angka >= 0.")
      setSubmitting(false)
      return
    }

    if (!Number.isFinite(stock) || !Number.isSafeInteger(stock) || stock < 0) {
      setError("Stok harus berupa angka >= 0.")
      setSubmitting(false)
      return
    }

    if (price > PG_INT_MAX) {
      setError(`Harga maksimal adalah ${PG_INT_MAX}.`)
      setSubmitting(false)
      return
    }

    if (stock > PG_INT_MAX) {
      setError(`Stok maksimal adalah ${PG_INT_MAX}.`)
      setSubmitting(false)
      return
    }

    try {
      if (!editingProduct) {
        const created = await createProduct({
          ...(sku ? { sku } : {}),
          name,
          ...(description ? { description } : {}),
          price,
          stock,
        })

        setProducts((prev) => [created, ...prev])
        setMessage("Barang berhasil ditambahkan.")
        setSheetOpen(false)
        return
      }

      const patch: Parameters<typeof updateProduct>[1] = {}
      if (sku && sku !== editingProduct.sku) patch.sku = sku
      if (name !== editingProduct.name) patch.name = name
      if (description !== (editingProduct.description ?? "")) patch.description = description
      if (price !== editingProduct.price) patch.price = price

      let updated = editingProduct
      if (Object.keys(patch).length) {
        updated = await updateProduct(editingProduct.id, patch)
      }

      const nextStock = stock
      const delta = nextStock - editingProduct.stock
      if (delta !== 0) {
        const stockUpdated = await adjustProductStock({
          productId: editingProduct.id,
          quantityDelta: delta,
          note: "AdminPanel stock update",
        })
        updated = { ...updated, stock: stockUpdated.stock, updatedAt: stockUpdated.updatedAt }
      }

      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setMessage("Barang berhasil diperbarui.")
      setSheetOpen(false)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(product: Product) {
    const ok = window.confirm(`Hapus barang "${product.name}"? (barang akan dinonaktifkan)`)
    if (!ok) return

    setDeletingId(product.id)
    setError(null)
    setMessage(null)
    try {
      await deleteProduct(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setMessage("Barang berhasil dihapus (dinonaktifkan).")
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <AdminPanelSkeleton />

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground text-sm">
          CRUD barang (produk) seperti di project lama.
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

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Barang / Produk</CardTitle>
              <CardDescription>
                Tambah, ubah, dan hapus barang. SKU bisa dikosongkan agar dibuat otomatis.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="w-full sm:w-64">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari barang..." />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshProducts}
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
                  <th>Produk</th>
                  <th>Harga</th>
                  <th>Stok</th>
                  <th className="w-36"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length ? (
                  filtered.map((p) => {
                    const isOut = p.stock <= 0
                    const isDeleting = deletingId === p.id

                    return (
                      <tr key={p.id} className="[&>td]:px-4 [&>td]:py-3">
                        <td>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              {p.sku}
                              {p.description ? ` • ${p.description}` : ""}
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-semibold">{formatCurrencyIdr(p.price)}</td>
                        <td className="whitespace-nowrap">
                          {isOut ? (
                            <Badge variant="destructive">Habis</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-primary/10 text-primary">
                              {p.stock} tersedia
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() => openEditSheet(p)}
                              disabled={submitting || Boolean(deletingId)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => handleDelete(p)}
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
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Tidak ada barang.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Manajemen Pengguna & Otoritas</CardTitle>
          <CardDescription>
            Pengaturan akun pengguna dan penetapan role wewenang sistem (Admin, Backoffice, Member).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
            Role Management Aktif
          </Badge>
          <Badge variant="outline" className="text-xs">
            Akses Bertingkat
          </Badge>
          <span className="text-xs text-muted-foreground ml-1">
            Dikelola dengan enkripsi token akses aman.
          </span>
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditingProduct(null)
        }}
      >
        <SheetContent className="flex flex-col gap-4">
          <SheetHeader>
            <SheetTitle>{editingProduct ? "Edit Barang" : "Tambah Barang"}</SheetTitle>
            <SheetDescription>
              {editingProduct
                ? "Ubah data barang dan stok."
                : "Isi data barang baru. SKU boleh dikosongkan agar dibuat otomatis."}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU (opsional)</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
                placeholder="Kosongkan untuk otomatis"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Nama Barang</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Air Mineral"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Deskripsi (opsional)</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Contoh: 600ml"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Harga</Label>
              <Input
                id="price"
                type="number"
                min={0}
                max={PG_INT_MAX}
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stock">Stok</Label>
              <Input
                id="stock"
                type="number"
                min={0}
                max={PG_INT_MAX}
                value={form.stock}
                onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
                placeholder="0"
              />
              {editingProduct ? (
                <p className="text-muted-foreground text-xs">Stok saat ini: {editingProduct.stock}</p>
              ) : null}
            </div>
          </div>

          <SheetFooter className="mt-auto">
            <Button
              variant="outline"
              onClick={() => setSheetOpen(false)}
              disabled={submitting}
            >
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
