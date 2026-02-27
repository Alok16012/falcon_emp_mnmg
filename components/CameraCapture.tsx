"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Camera, X, RefreshCw, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraCaptureProps {
    onCapture: (file: File) => void
    onClose: () => void
}

/** Checks if the device likely has a mobile/touch screen */
const isMobileDevice = () =>
    typeof navigator !== "undefined" &&
    /android|iphone|ipad|ipod/i.test(navigator.userAgent)

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [stream, setStream] = useState<MediaStream | null>(null)
    const [captured, setCaptured] = useState<string | null>(null) // base64 preview
    const [permissionError, setPermissionError] = useState(false)
    const [loading, setLoading] = useState(true)
    const isMobile = isMobileDevice()

    const startCamera = useCallback(async () => {
        setLoading(true)
        setPermissionError(false)
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            })
            setStream(mediaStream)
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }
        } catch (err) {
            console.error("Camera error:", err)
            setPermissionError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(t => t.stop())
            setStream(null)
        }
    }, [stream])

    useEffect(() => {
        if (!isMobile) {
            startCamera()
        } else {
            setLoading(false)
        }
        return () => {
            stopCamera()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85)
        setCaptured(dataUrl)
        stopCamera()
    }

    const retake = () => {
        setCaptured(null)
        startCamera()
    }

    const confirmCapture = () => {
        if (!captured || !canvasRef.current) return
        canvasRef.current.toBlob(blob => {
            if (!blob) return
            const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" })
            onCapture(file)
            onClose()
        }, "image/jpeg", 0.85)
    }

    const handleMobileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        onCapture(file)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <Camera className="h-5 w-5 text-primary" />
                        <h2 className="font-bold text-base">Camera Capture</h2>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { stopCamera(); onClose() }}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Mobile: use native camera input */}
                    {isMobile ? (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="p-5 rounded-full bg-primary/10">
                                <Camera className="h-10 w-10 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Apne mobile camera se photo lein ya gallery se upload karein
                            </p>
                            <div className="flex gap-3 w-full">
                                <Button
                                    className="flex-1"
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute("capture", "environment")
                                            fileInputRef.current.click()
                                        }
                                    }}
                                >
                                    <Camera className="h-4 w-4 mr-2" />
                                    Camera
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.removeAttribute("capture")
                                            fileInputRef.current.click()
                                        }
                                    }}
                                >
                                    Gallery
                                </Button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleMobileFileChange}
                            />
                        </div>
                    ) : permissionError ? (
                        /* Permission denied fallback */
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="p-4 rounded-full bg-destructive/10">
                                <AlertCircle className="h-8 w-8 text-destructive" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Camera permission denied. Please allow camera access in your browser settings, or upload a file directly.
                            </p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={startCamera}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Retry
                                </Button>
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Upload File
                                </Button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleMobileFileChange}
                            />
                        </div>
                    ) : captured ? (
                        /* Preview captured photo */
                        <div className="space-y-4">
                            <div className="rounded-xl overflow-hidden border bg-black">
                                <img src={captured} alt="Captured" className="w-full object-contain max-h-72" />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={retake}>
                                    <RefreshCw className="h-4 w-4 mr-2" /> Retake
                                </Button>
                                <Button className="flex-1" onClick={confirmCapture}>
                                    <Check className="h-4 w-4 mr-2" /> Use Photo
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* Live webcam feed */
                        <div className="space-y-4">
                            <div className={cn(
                                "relative rounded-xl overflow-hidden border bg-black flex items-center justify-center",
                                "min-h-[240px]"
                            )}>
                                {loading && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full max-h-72 object-cover"
                                    onLoadedMetadata={() => setLoading(false)}
                                />
                            </div>
                            <Button className="w-full" onClick={capturePhoto} disabled={loading}>
                                <Camera className="h-4 w-4 mr-2" /> Capture Photo
                            </Button>
                        </div>
                    )}
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    )
}
