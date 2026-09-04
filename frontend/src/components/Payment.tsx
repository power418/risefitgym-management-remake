import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/services/api"
import QRCode from "react-qr-code"
import { useState } from "react"

declare global {
    interface Window {
        snap?: {
            pay: (
                token: string,
                callbacks?: {
                    onSuccess?: (result: unknown) => void
                    onPending?: (result: unknown) => void
                    onError?: (result: unknown) => void
                    onClose?: () => void
                }
            ) => void
        }
    }
}

type PaymentTokenResponse = {
  paymentId: string
  token: string
  redirectUrl: string
  qrData: string
}

const Payment = () => {
    const [loading, setLoading] = useState(false);
    const [orderId, setOrderId] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)
    const [result, setResult] = useState<PaymentTokenResponse | null>(null)

    const handlePay = async () => {
        setError(null)
        setInfo(null)
        setResult(null)

        const orderIdValue = orderId.trim()
        if (!orderIdValue) {
            setError("Order ID wajib diisi.")
            return
        }

        setLoading(true);
        try {
            const response = await api.post<PaymentTokenResponse>("/payment/token", {
                orderId: orderIdValue,
            })

            const data = response.data
            setResult(data)

            if (window.snap?.pay) {
                window.snap.pay(data.token, {
                    onSuccess: () => setInfo("Payment success."),
                    onPending: () => setInfo("Menunggu pembayaran (pending)."),
                    onError: () => setError("Payment gagal."),
                    onClose: () => setInfo("Popup ditutup sebelum selesai."),
                })
            } else {
                setInfo("Snap belum ter-load. Buka redirect URL / scan QR untuk lanjut pembayaran.")
            }
        } catch (err) {
            console.error('Payment Error:', err);
            setError("Gagal membuat payment token. Pastikan orderId valid & status order masih PENDING.")
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integrasi Midtrans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    Masukkan Order ID transaksi untuk memproses pembayaran online melalui payment gateway Midtrans.
                </p>

                {error ? (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {info ? (
                    <Alert>
                        <AlertTitle>Info</AlertTitle>
                        <AlertDescription>{info}</AlertDescription>
                    </Alert>
                ) : null}

                <div className="grid gap-2">
                    <Label htmlFor="orderId">Order ID</Label>
                    <Input
                        id="orderId"
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        placeholder="contoh: 7b1d3c..."
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={handlePay} disabled={loading}>
                        {loading ? "Processing..." : "Bayar Sekarang"}
                    </Button>
                    {result?.redirectUrl ? (
                        <Button asChild variant="outline">
                            <a href={result.redirectUrl} target="_blank" rel="noreferrer">
                                Buka Redirect URL
                            </a>
                        </Button>
                    ) : null}
                </div>

                {result?.qrData ? (
                    <div className="grid gap-3 pt-2">
                        <p className="text-muted-foreground text-xs">
                            QR / Redirect: <code className="font-mono break-all">{result.qrData}</code>
                        </p>
                        <div className="w-fit rounded-lg border bg-white p-3">
                            <QRCode value={result.qrData} size={160} />
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
};

export default Payment;
