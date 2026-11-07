"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Loader2,
  Sparkles,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Layers,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import Link from "next/link";

interface MemberQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    name: string;
    cbUserId: string | null;
    email: string;
    registration?: string | null;
  };
}

export default function MemberQRDialog({
  open,
  onOpenChange,
  member,
}: MemberQRDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingTransparent, setIsDownloadingTransparent] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [previewMode, setPreviewMode] = useState<"transparent" | "card">("transparent");

  const identifier = member.cbUserId || member.registration || member.email;
  const profileUrl = typeof window !== "undefined"
    ? `${window.location.origin}/member/${encodeURIComponent(identifier)}`
    : `https://app.codebreakersgcek.tech/member/${encodeURIComponent(identifier)}`;

  const generateQR = useCallback(async () => {
    if (!canvasRef.current || !open) return;

    setIsGenerating(true);
    try {
      const qrWidth = typeof window !== "undefined" && window.innerWidth < 640 ? 210 : 260;
      await QRCode.toCanvas(canvasRef.current, profileUrl, {
        errorCorrectionLevel: "H",
        width: qrWidth,
        margin: previewMode === "transparent" ? 1 : 2,
        color: {
          dark: "#000000ff",
          light: previewMode === "transparent" ? "#00000000" : "#ffffffff",
        },
      });
    } catch (err) {
      console.error("Error generating QR code:", err);
    } finally {
      setIsGenerating(false);
    }
  }, [profileUrl, open, previewMode]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(generateQR, 50);
      return () => clearTimeout(timer);
    }
  }, [open, generateQR]);

  // Option 1: Download Removed BG QR Only (Transparent PNG, No card, No labels)
  const handleDownloadTransparent = async () => {
    try {
      setIsDownloadingTransparent(true);

      // Generate pure high-resolution QR code with transparent background and minimal margin
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        errorCorrectionLevel: "H",
        width: 1024,
        margin: 1, // Minimal margin to keep QR modules prominent like sample
        color: {
          dark: "#000000ff",
          light: "#00000000", // 100% transparent background
        },
      });

      const safeName = (member.cbUserId || member.name || "member")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");

      const link = document.createElement("a");
      link.download = `${safeName}_QR_Transparent.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Removed BG QR Code downloaded! ✨");
    } catch (err) {
      console.error("Error downloading transparent QR code:", err);
      toast.error("Failed to generate transparent QR code");
    } finally {
      setIsDownloadingTransparent(false);
    }
  };

  // Option 2: Download Full QR Card (White background card with member name & CB ID)
  const handleDownloadCard = async () => {
    try {
      setIsDownloadingCard(true);

      // Generate offscreen QR code canvas
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, profileUrl, {
        errorCorrectionLevel: "H",
        width: 600,
        margin: 2,
        color: {
          dark: "#000000ff",
          light: "#ffffffff",
        },
      });

      const downloadCanvas = document.createElement("canvas");
      const ctx = downloadCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas context");

      const padding = 36;
      const labelHeight = 56;
      const idHeight = 28;
      const totalWidth = qrCanvas.width + padding * 2;
      const totalHeight = qrCanvas.height + padding * 2 + labelHeight + idHeight;

      downloadCanvas.width = totalWidth;
      downloadCanvas.height = totalHeight;

      // Crisp White Card Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      // Card border
      ctx.strokeStyle = "#e4e4e7";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, totalWidth - 2, totalHeight - 2);

      // Member name at top
      ctx.fillStyle = "#09090b";
      ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(member.name || "Member", totalWidth / 2, padding + 22);

      // CB User ID
      ctx.fillStyle = "#71717a";
      ctx.font = "bold 14px monospace";
      ctx.fillText(member.cbUserId || member.email || "", totalWidth / 2, padding + 46);

      // Draw QR code
      ctx.drawImage(qrCanvas, padding, padding + labelHeight + idHeight - 12);

      const safeName = (member.cbUserId || member.name || "member")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_");

      const link = document.createElement("a");
      link.download = `${safeName}_QR_Card.png`;
      link.href = downloadCanvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Member QR Card downloaded!");
    } catch (err) {
      console.error("Error generating QR card:", err);
      toast.error("Failed to generate QR card");
    } finally {
      setIsDownloadingCard(false);
    }
  };

  // Copy transparent QR image directly to clipboard
  const handleCopyTransparentImage = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        errorCorrectionLevel: "H",
        width: 1024,
        margin: 1,
        color: {
          dark: "#000000ff",
          light: "#00000000",
        },
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (typeof window !== "undefined" && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopiedImage(true);
        toast.success("Transparent QR copied to clipboard!");
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        toast.error("Clipboard image copy not supported in this browser");
      }
    } catch (err) {
      console.error("Failed to copy image:", err);
      toast.error("Could not copy QR image");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopiedLink(true);
      toast.success("Profile link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">{member.name}</DialogTitle>
          <DialogDescription className="text-center">
            {member.cbUserId ? (
              <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
                {member.cbUserId}
              </span>
            ) : (
              <span className="font-mono text-xs">{member.email}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-1">
          {/* Mode Switcher Toggle */}
          <div className="flex items-center gap-1 p-1 bg-muted/80 rounded-lg text-xs font-medium w-full">
            <button
              type="button"
              onClick={() => setPreviewMode("transparent")}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                previewMode === "transparent"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Removed BG</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("card")}
              className={`flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                previewMode === "card"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Card Pass</span>
            </button>
          </div>

          {/* QR Canvas Display */}
          <div
            className={`rounded-xl border p-3 flex items-center justify-center min-h-[230px] min-w-[230px] transition-colors relative ${
              previewMode === "transparent"
                ? "bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] dark:bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)]"
                : "bg-white"
            }`}
          >
            {isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl backdrop-blur-[1px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <canvas ref={canvasRef} className={isGenerating ? "opacity-0" : "opacity-100 transition-opacity"} />
          </div>

          <p className="text-[11px] text-muted-foreground text-center max-w-[260px] leading-tight">
            {previewMode === "transparent"
              ? "Pure QR code without background. Perfect for designing ID badges, cards, posters, and lanyards."
              : "Standard pass with member name, CodeBreakers ID, and QR code for attendance."}
          </p>

          {/* Download Action Buttons */}
          <div className="flex flex-col gap-2 w-full pt-1">
            {/* Primary Action: Download Removed BG QR Only */}
            <Button
              variant="default"
              onClick={handleDownloadTransparent}
              disabled={isDownloadingTransparent || isGenerating}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer h-10 shadow-sm"
            >
              {isDownloadingTransparent ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2 text-amber-400" />
              )}
              Download Removed BG QR (Transparent)
            </Button>

            {/* Secondary Action: Download Full QR Card */}
            <Button
              variant="outline"
              onClick={handleDownloadCard}
              disabled={isDownloadingCard || isGenerating}
              className="w-full cursor-pointer h-9 text-xs"
            >
              {isDownloadingCard ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-2" />
              )}
              Download Full QR Card (White BG)
            </Button>

            {/* Quick Action Utilities */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTransparentImage}
                title="Copy transparent PNG to clipboard"
                className="h-8 text-[11px] gap-1 px-2"
              >
                {copiedImage ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>{copiedImage ? "Copied" : "Copy QR"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                title="Copy public member profile link"
                className="h-8 text-[11px] gap-1 px-2"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>{copiedLink ? "Copied" : "Link"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                asChild
                title="Open public profile in new tab"
                className="h-8 text-[11px] gap-1 px-2"
              >
                <Link href={`/member/${encodeURIComponent(identifier)}`} target="_blank">
                  <span>Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
