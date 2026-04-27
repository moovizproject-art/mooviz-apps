#!/usr/bin/env python3
"""
Post-build: uncompress .so files inside AAB so zipalign can 16KB-align them.

Run BEFORE zipalign:
    python3 fix_aab_playstore_16kb.py app-release.aab app-release-uncompressed.aab
Then:
    zipalign -f -P 16 4 app-release-uncompressed.aab app-release-aligned.aab
Then re-sign app-release-aligned.aab with jarsigner.
"""
import sys, zipfile, struct

PAGE = 16384

def _get_first_load_align(data: bytes) -> int:
    if data[:4] != b'\x7fELF':
        return 0
    bits = data[4]
    if bits == 2:
        ph_off  = struct.unpack_from('<Q', data, 32)[0]
        ph_size = struct.unpack_from('<H', data, 54)[0]
        ph_num  = struct.unpack_from('<H', data, 56)[0]
    elif bits == 1:
        ph_off  = struct.unpack_from('<I', data, 28)[0]
        ph_size = struct.unpack_from('<H', data, 42)[0]
        ph_num  = struct.unpack_from('<H', data, 44)[0]
    else:
        return 0
    for i in range(ph_num):
        off = ph_off + i * ph_size
        if off + ph_size > len(data):
            break
        if struct.unpack_from('<I', data, off)[0] == 1:  # PT_LOAD
            return struct.unpack_from('<Q' if bits == 2 else '<I', data, off + (48 if bits == 2 else 28))[0]
    return 0

def uncompress_so_files(input_aab: str, output_aab: str) -> None:
    stored = 0
    kept_compressed = 0
    with zipfile.ZipFile(input_aab, 'r') as zin, \
         zipfile.ZipFile(output_aab, 'w', zipfile.ZIP_DEFLATED, allowZip64=True) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename.endswith('.so'):
                align = _get_first_load_align(data[:8192])
                if align >= PAGE:
                    info.compress_type = zipfile.ZIP_STORED
                    stored += 1
                else:
                    kept_compressed += 1
            zout.writestr(info, data, compress_type=info.compress_type)

    print(f"  Stored uncompressed: {stored} .so files (ELF p_align >= 16KB)")
    if kept_compressed:
        print(f"  Kept compressed:     {kept_compressed} .so files (ELF p_align < 16KB — check patch)")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input.aab> <output.aab>")
        sys.exit(1)
    print(f"Uncompressing 16KB-aligned .so files: {sys.argv[1]} → {sys.argv[2]}")
    uncompress_so_files(sys.argv[1], sys.argv[2])
    print("Done.")
