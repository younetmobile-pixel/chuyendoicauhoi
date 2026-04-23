/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Scan,
  RotateCcw,
  BookOpen,
  Languages,
  ShieldCheck,
  Zap,
  Cpu,
  FileText,
  History,
  LogIn,
  LogOut,
  Trash2,
  ChevronRight,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import { scanExamImage } from './services/geminiService';
import { auth, loginWithGoogle, logout, saveScan, getUserScans, deleteScan, ScanRecord } from './lib/firebase.ts';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchHistory(currentUser.uid);
      } else {
        setScans([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (userId: string) => {
    try {
      const data = await getUserScans(userId);
      setScans(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setError("Đăng nhập thất bại. Vui lòng thử lại.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      reset();
    } catch (err) {
      setError("Đăng xuất thất bại.");
    }
  };

  const handleExportWord = async () => {
    if (!result) return;
    // ... Word export logic ...
    const lines = result.split('\n');
    const sections: any[] = [
      new Paragraph({
        text: "K-ANALYZER PRO - BÁO CÁO PHÂN TÍCH ĐỀ THI",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 },
      })
    ];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      if (trimmedLine.startsWith('## ')) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('## ', ''),
                bold: true,
                color: "1e293b",
                size: 28,
              })
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          })
        );
      } else if (trimmedLine.startsWith('### ')) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('### ', ''),
                bold: true,
                color: "4f46e5",
                size: 24,
              })
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 120 },
          })
        );
      } else if (trimmedLine.startsWith('---')) {
        // Divider
      } else {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 22,
              })
            ],
            spacing: { after: 120 },
          })
        );
      }
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: sections,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `K-Analyzer-Result-${new Date().getTime()}.docx`);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn một tệp hình ảnh.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      setResult(null);
      setError(null);
      setTimeout(() => triggerAutoScan(result), 100);
    };
    reader.readAsDataURL(file);
  };

  const triggerAutoScan = async (imageData: string) => {
    setIsScanning(true);
    setError(null);
    try {
      const mimeType = imageData.split(';')[0].split(':')[1];
      const data = await scanExamImage(imageData, mimeType);
      setResult(data.text);
      
      // Auto save to history if user is logged in
      if (auth.currentUser) {
        const title = data.text.split('\n')[0].replace('## ', '').substring(0, 50) || "Bản quét mới";
        await saveScan(auth.currentUser.uid, title, data.text);
        fetchHistory(auth.currentUser.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi phân tích hình ảnh.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = async () => {
    if (!image) return;
    setIsScanning(true);
    setError(null);
    try {
      const mimeType = image.split(';')[0].split(':')[1];
      const data = await scanExamImage(image, mimeType);
      setResult(data.text);
      
      if (user) {
        const title = data.text.split('\n')[0].replace('## ', '').substring(0, 50) || "Bản quét mới";
        await saveScan(user.uid, title, data.text);
        fetchHistory(user.uid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi phân tích hình ảnh.');
    } finally {
      setIsScanning(false);
    }
  };

  const loadFromHistory = (scan: ScanRecord) => {
    setResult(scan.resultText);
    setImage(null);
    setShowHistory(false);
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) return;
    try {
      await deleteScan(id);
      if (user) fetchHistory(user.uid);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center px-8 border-b border-slate-200 bg-white justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">K</span>
          </div>
          <h1 className="font-bold text-lg tracking-tight">K-ANALYZER <span className="text-slate-400 font-normal">PRO</span></h1>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'}`}
              title="Lịch sử quét"
            >
              <History className="w-5 h-5" />
            </button>
          )}

          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-tight">Thành viên Pro</span>
              </div>
              <img src={user.photoURL || ""} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-200" />
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Đăng nhập Google
            </button>
          )}
          
          <div className="flex gap-2 ml-4">
            {result && (
              <button 
                onClick={handleExportWord}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Xuất Word
              </button>
            )}
            {!image ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                Quét Ảnh Mới
              </button>
            ) : (
              <button 
                onClick={reset}
                className="px-4 py-2 border border-slate-200 rounded text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Làm mới
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* History Sidebar overlay */}
        <AnimatePresence>
          {showHistory && (
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="absolute left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-200 z-20 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  Lịch sử phân tích
                </h2>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {scans.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-10" />
                    <p className="text-xs uppercase font-bold tracking-widest">Chưa có lịch sử</p>
                  </div>
                ) : (
                  scans.map((scan) => (
                    <div 
                      key={scan.id}
                      onClick={() => loadFromHistory(scan)}
                      className="group p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight uppercase tracking-tight">{scan.title}</h3>
                        <button 
                          onClick={(e) => scan.id && handleDeleteHistory(e, scan.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all shadow-sm bg-white rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                        <span>{scan.timestamp?.toDate().toLocaleDateString('vi-VN')}</span>
                        <span className="text-indigo-400 uppercase">Xem lại <ChevronRight className="w-3 h-3 inline" /></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left: Source Preview Sidebar */}
        <section className="w-[400px] border-r border-slate-200 bg-slate-100 p-6 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dữ Liệu Nguồn (OCR Source)</h2>
            {image && <span className="text-[10px] text-slate-400 font-mono">READY TO SCAN</span>}
          </div>

          <div className="flex-1 bg-white border border-slate-300 rounded shadow-inner relative overflow-hidden flex flex-col">
            {!image ? (
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  flex-1 flex flex-col items-center justify-center p-8 cursor-pointer transition-all
                  ${dragActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden" 
                  accept="image/*"
                />
                <Upload className="w-10 h-10 text-slate-300 mb-4" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider text-center">Tải lên hoặc kéo thả ảnh đề thi</p>
                {!user && (
                    <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold text-center italic">Đăng nhập để tự động lưu lịch sử</p>
                )}
              </div>
            ) : (
              <div className="flex-1 relative group bg-slate-100">
                <img 
                  src={image} 
                  alt="Source" 
                  className="w-full h-full object-contain"
                />
                
                {isScanning && (
                  <div className="absolute inset-0 bg-indigo-500/5 border-y border-indigo-400/50 flex flex-col items-center justify-center">
                    <div className="w-full h-[1px] bg-indigo-500 absolute top-0 shadow-[0_0_10px_indigo] animate-[scan_2s_infinite]"></div>
                    <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded shadow-sm">ĐANG PHÂN TÍCH...</span>
                  </div>
                )}
                
                {!isScanning && !result && (
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={handleScan}
                      className="px-6 py-3 bg-indigo-600 text-white rounded font-bold text-sm shadow-xl flex items-center gap-2 transform active:scale-95 transition-all"
                    >
                      <Scan className="w-5 h-5" /> BẮT ĐẦU PHÂN TÍCH
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="p-3 bg-white rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Chế độ
              </div>
              <div className="text-lg font-bold text-indigo-600 font-mono">Vision-X</div>
            </div>
            <div className="p-3 bg-white rounded border border-slate-200">
              <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Engine
              </div>
              <div className="text-lg font-bold text-emerald-600 font-mono">Precision</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 p-3 rounded flex items-start gap-2 shadow-sm">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[10px] uppercase font-bold text-red-800 tracking-tight">
                {error}
              </div>
            </div>
          )}
        </section>

        {/* Right: Intelligence Output */}
        <section className="flex-1 bg-white p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              {isScanning ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center space-y-6 py-20"
                >
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Đang thực thi quy trình phân tích</p>
                    <p className="text-lg font-medium text-slate-800">Trích xuất vựng pháp & giải pháp sư phạm...</p>
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="markdown-body custom-result"
                >
                  <ReactMarkdown>{result}</ReactMarkdown>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-40">
                  <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-[0.3em]">Chờ nhập dữ liệu</p>
                </div>
              )}
            </AnimatePresence>
            
            {result && !isScanning && (
              <div className="flex items-center justify-center py-12 opacity-30 mt-8">
                <div className="w-full h-px bg-slate-400"></div>
                <div className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap">Kết thúc báo cáo</div>
                <div className="w-full h-px bg-slate-400"></div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-10 bg-slate-900 text-white px-8 flex items-center justify-between text-[10px] tracking-wider uppercase font-medium shrink-0">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Professional Grade
          </span>
          <span className="text-slate-400 flex items-center gap-2">
             <UserIcon className="w-3 h-3" /> {user ? `Authenticated: ${user.email}` : "Cloud Sync Disabled"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500">Gemini 2.0 Flash Vision</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
            Online
          </div>
        </div>
      </footer>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
      `}</style>
    </div>
  );
}
