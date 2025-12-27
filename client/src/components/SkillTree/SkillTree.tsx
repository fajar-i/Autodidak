import React, { useState, useRef, useEffect } from 'react';
import { useAuthContext } from '~/hooks/AuthContext';
import { Sun, Moon, ArrowLeft, RefreshCw } from 'lucide-react'; // Tambah icon refresh
import * as LucideIcons from 'lucide-react';

// --- 1. UTILS ---
function kebabToPascal(str) {
    if (!str) return 'Flag';
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function getIconComponent(iconName) {
    if (!iconName) return LucideIcons.Flag;
    const pascalName = kebabToPascal(iconName);
    // @ts-ignore
    return LucideIcons[pascalName] || LucideIcons.Flag;
}

const CONFIG = { nodeRadius: 35, siblingGap: 70, levelGap: 140 };
const CANVAS_OFFSET = 2500;

// --- 2. LAYOUT LOGIC ---
function layoutAdaptive(rawSkills, rootId) {
    try {
        if (!rawSkills || !Array.isArray(rawSkills) || rawSkills.length === 0) return [];
        const flatSkills = JSON.parse(JSON.stringify(rawSkills));
        const nodeMap = new Map();

        flatSkills.forEach((skill) => {
            nodeMap.set(skill.id, { ...skill, children: [], position: { x: 0, y: 0 } });
        });

        flatSkills.forEach((skill) => {
            const originalChildren = skill.children || [];
            if (Array.isArray(originalChildren)) {
                originalChildren.forEach((child) => {
                    const childId = typeof child === 'string' ? child : child?.id;
                    const parentNode = nodeMap.get(skill.id);
                    const childNode = nodeMap.get(childId);
                    if (parentNode && childNode) parentNode.children.push(childNode);
                });
            }
        });

        let currentLeafX = 0;
        function calculatePosition(node, depth) {
            node.position.y = depth * CONFIG.levelGap;
            if (node.children.length === 0) {
                node.position.x = currentLeafX;
                currentLeafX += CONFIG.nodeRadius * 2 + CONFIG.siblingGap;
            } else {
                node.children.forEach((child) => calculatePosition(child, depth + 1));
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node.position.x = (firstChild.position.x + lastChild.position.x) / 2;
            }
        }

        // Cari root (Backend Anda menggunakan id: 'orientasi' sebagai root)
        const rootNode = nodeMap.get(rootId) || nodeMap.get(flatSkills[0]?.id);

        if (rootNode) {
            calculatePosition(rootNode, 0);

            // Centering Y
            let maxY = 0;
            nodeMap.forEach((node) => { if (node.position.y > maxY) maxY = node.position.y; });
            nodeMap.forEach((node) => { node.position.y = maxY - node.position.y; });

            const result = [];
            const visited = new Set();
            function flattenResult(node) {
                if (visited.has(node.id)) return;
                visited.add(node.id);
                result.push(node);
                node.children.forEach(flattenResult);
            }
            flattenResult(rootNode);
            return result;
        }
        return [];
    } catch (err) {
        console.error('layoutAdaptive error:', err);
        return [];
    }
}

// --- PENTING: KOSONGKAN DEFAULT ---
// Ini menjamin kita tidak akan melihat apapun jika API gagal load
const DEFAULT_SKILLS = [];

const SkillTree = ({ dataTask = [], conversationId = null }) => {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const { token } = useAuthContext();
    const [skills, setSkills] = useState([]);
    const [debugStatus, setDebugStatus] = useState({ status: 'IDLE', message: 'Waiting...', nodeCount: 0 });
    const [offset, setOffset] = useState({ x: 100, y: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const hasCenteredRef = useRef(false);

    // --- FETCH DATA FUNCTION ---
    const loadDataFromBackend = async () => {
        if (!conversationId || conversationId === 'new') {
            setDebugStatus({ status: 'SKIPPED', message: 'No Conversation ID', nodeCount: 0 });
            return;
        }

        setDebugStatus({ status: 'LOADING', message: 'Fetching from API...', nodeCount: 0 });

        try {
            const url = `/api/skills?conversationId=${encodeURIComponent(conversationId)}`;
            console.log("🔥 FETCHING:", url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            console.log("✅ RAW BACKEND DATA:", data);

            // Backend Anda membungkus array di dalam properti `skillTreeData`
            let rawTreeData = [];

            if (data.skillTreeData && Array.isArray(data.skillTreeData)) {
                rawTreeData = data.skillTreeData;
            } else if (Array.isArray(data)) {
                // Fallback jika backend mengirim array langsung
                rawTreeData = data;
            }

            if (rawTreeData.length > 0) {
                // Proses Layout
                const layouted = layoutAdaptive(rawTreeData, 'orientasi');
                setSkills(layouted);

                // Update Debug Info
                setDebugStatus({
                    status: 'SUCCESS',
                    message: `Loaded from Backend`,
                    nodeCount: layouted.length,
                    firstNode: layouted[0]?.name
                });
            } else {
                setDebugStatus({ status: 'EMPTY', message: 'Backend returned empty array', nodeCount: 0 });
            }

        } catch (err) {
            console.error("❌ LOAD ERROR:", err);
            setDebugStatus({ status: 'ERROR', message: err.message, nodeCount: 0 });
        }
    };
    useEffect(() => {
        // Jika ganti conversation, kita izinkan auto-center ulang
        if (token && conversationId) {
            loadDataFromBackend();
        }
        hasCenteredRef.current = false;
        // Reset offset sementara (opsional)
        setOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }, [conversationId, token]);
    useEffect(() => {
        // Jalankan hanya jika skills sudah terisi dan belum pernah dicenter
        if (skills.length > 0 && !hasCenteredRef.current) {

            // Cari Root Node (biasanya 'orientasi' atau elemen pertama)
            const rootNode = skills.find(s => s.id === 'orientasi') || skills[0];

            if (rootNode) {
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;

                // Hitung Offset agar Root berada tepat di tengah layar
                const centerX = ((screenWidth / 2) - rootNode.position.x)/skills.length;

                // Posisikan Root agak ke bawah sedikit (80% dari tinggi layar) 
                // supaya tree yang tumbuh ke atas terlihat jelas, 
                // ATAU (screenHeight / 2) jika ingin benar-benar di tengah.
                const centerY = (screenHeight * 0.8) - rootNode.position.y;

                console.log(`🎥 Auto-focusing camera to Root: ${rootNode.name} at (${centerX}, ${centerY})`);

                setOffset({ x: centerX, y: centerY });

                // Tandai sudah dicenter agar tidak loncat saat user tap skill
                hasCenteredRef.current = true;
            }
        }
    }, [skills]); // Trigger setiap kali skills berubah (tapi dijaga oleh if !hasCenteredRef)
    // Initial Load


    // Handle Tap/Unlock
    const handleSkillTap = (tappedSkill) => {
        // ... (Logic unlock sama seperti sebelumnya) ...
        // Saat save, panggil API update lalu refresh local state
        alert(`Clicked: ${tappedSkill.name}`);
    };

    // Mouse Events handlers (tetap sama)
    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };

    return (
        <div
            className={`relative w-full h-screen overflow-hidden select-none transition-colors duration-500 ${isDarkMode ? 'bg-[#121212]' : 'bg-[#F4F3EF]'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
        >
            {/* --- DEBUG OVERLAY (Hapus ini nanti setelah produksi) --- */}
            <div className="absolute top-20 left-8 z-[100] bg-black/80 text-green-400 p-4 rounded font-mono text-xs border border-green-500 shadow-xl pointer-events-none">
                <h3 className="font-bold border-b border-green-500 mb-2 pb-1">BACKEND CONNECTION STATUS</h3>
                <p>Status: <span className={debugStatus.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>{debugStatus.status}</span></p>
                <p>Msg: {debugStatus.message}</p>
                <p>Nodes: {debugStatus.nodeCount}</p>
                {debugStatus.firstNode && <p>Root: "{debugStatus.firstNode}"</p>}
                <p className="mt-2 text-gray-400 italic">Conversation ID: {conversationId?.slice(0, 8)}...</p>
            </div>

            <div
                className="absolute transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            >
                <svg
                    className="absolute overflow-visible pointer-events-none"
                    width="5000"
                    height="5000"
                    style={{ left: `-${CANVAS_OFFSET}px`, top: `-${CANVAS_OFFSET}px` }}
                >
                    {skills.map((s) =>
                        s.children.map((child) => (
                            <line
                                key={`${s.id}-${child.id}`}
                                x1={s.position.x + CANVAS_OFFSET}
                                y1={s.position.y + CANVAS_OFFSET}
                                x2={child.position.x + CANVAS_OFFSET}
                                y2={child.position.y + CANVAS_OFFSET}
                                stroke={isDarkMode ? '#ffffff' : '#000000'}
                                strokeWidth="4"
                            />
                        ))
                    )}
                </svg>

                {skills.map((s) => {
                    const IconComp = getIconComponent(s.icon);
                    return (
                        <div
                            key={s.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                            style={{ left: s.position.x, top: s.position.y }}
                            onClick={(e) => { e.stopPropagation(); handleSkillTap(s); }}
                        >
                            {/* Neobrutalism Shadow */}
                            <div className="absolute top-1 left-1 w-16 h-16 rounded-full bg-black" />
                            <div className={`relative w-16 h-16 rounded-full border-4 border-black flex items-center justify-center transition-all hover:-translate-y-1 active:translate-x-0.5 active:translate-y-0.5
                                ${s.unlocked ? 'bg-[#4cdd7c]' : 'bg-[#fbe145]'}`}>
                                <IconComp size={28} color="black" />
                            </div>
                            <div className="mt-4 bg-black text-white px-3 py-1 text-[10px] font-mono text-center uppercase whitespace-nowrap shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                                {s.name}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Interface Overlay */}
            <div className="absolute bottom-8 left-8 flex gap-4 z-50">
                <button
                    onClick={loadDataFromBackend}
                    className="p-4 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all"
                    title="Force Reload from Backend"
                >
                    <RefreshCw size={24} color="black" />
                </button>
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-4 border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none transition-all"
                >
                    {isDarkMode ? <Sun size={24} color="black" /> : <Moon size={24} color="black" />}
                </button>
            </div>
        </div>
    );
};

export default SkillTree;