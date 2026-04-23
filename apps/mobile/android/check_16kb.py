#!/usr/bin/env python3
"""
Validate that all .so files in an AAB/APK are 16 KB page-aligned.
Usage: python3 check_16kb.py <path/to/app.aab>
Exit code 0 = all pass, 1 = failures found.
"""
import struct, sys, os, zipfile, tempfile, shutil

PAGE_SIZE = 16384

def get_load_alignment(data: bytes):
    if data[:4] != b'\x7fELF':
        return None
    bits = data[4]
    if bits == 2:  # 64-bit ELF
        ph_off  = struct.unpack_from('<Q', data, 32)[0]
        ph_size = struct.unpack_from('<H', data, 54)[0]
        ph_num  = struct.unpack_from('<H', data, 56)[0]
    elif bits == 1:  # 32-bit ELF
        ph_off  = struct.unpack_from('<I', data, 28)[0]
        ph_size = struct.unpack_from('<H', data, 42)[0]
        ph_num  = struct.unpack_from('<H', data, 44)[0]
    else:
        return None
    for i in range(ph_num):
        offset = ph_off + i * ph_size
        if offset + ph_size > len(data):
            break
        p_type = struct.unpack_from('<I', data, offset)[0]
        if p_type == 1:  # PT_LOAD
            if bits == 2:
                p_align = struct.unpack_from('<Q', data, offset + 48)[0]
            else:
                p_align = struct.unpack_from('<I', data, offset + 28)[0]
            return p_align
    return None

def check_aab(path: str):
    bad = []
    good = []
    with zipfile.ZipFile(path) as z:
        for entry in z.namelist():
            if not entry.endswith('.so'):
                continue
            with z.open(entry) as f:
                data = f.read(8192)
            align = get_load_alignment(data)
            if align is None:
                continue
            name = os.path.basename(entry)
            arch = entry.split('/')[-2] if '/' in entry else '?'
            if align < PAGE_SIZE:
                bad.append((arch, align, name))
            else:
                good.append((arch, align, name))
    return bad, good

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <app.aab|app.apk>")
        sys.exit(1)
    path = sys.argv[1]
    print(f"Checking: {path}\n")
    bad, good = check_aab(path)

    arm64_bad = [(a, al, n) for a, al, n in bad if a == 'arm64-v8a']
    arm64_good = [(a, al, n) for a, al, n in good if a == 'arm64-v8a']

    if bad:
        print(f"FAIL — {len(bad)} .so files are NOT 16 KB aligned ({len(arm64_bad)} arm64-v8a)")
        print()
        for arch, align, name in sorted(bad):
            print(f"  [{arch}] align={align:6}  {name}")
        print()
        print(f"PASS — {len(good)} .so files are 16 KB aligned")
        sys.exit(1)
    else:
        print(f"PASS — all {len(good)} .so files are 16 KB aligned ✓")
        sys.exit(0)

if __name__ == '__main__':
    main()
