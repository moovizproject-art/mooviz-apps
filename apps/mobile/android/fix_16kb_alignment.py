#!/usr/bin/env python3
"""
Fix 16KB alignment in native libraries BEFORE they're packaged into AAB.
This preserves the signature since we modify libraries before packaging.
"""

import os
import sys
import struct
import shutil
from pathlib import Path

PAGE_SIZE_16KB = 16384
ELF_MAGIC = b'\x7fELF'

def is_elf_file(file_path):
    """Check if a file is an ELF file."""
    try:
        with open(file_path, 'rb') as f:
            magic = f.read(4)
            return magic == ELF_MAGIC
    except Exception:
        return False

def read_elf_header(file_path):
    """Read ELF header and determine if it's 32-bit or 64-bit."""
    with open(file_path, 'rb') as f:
        magic = f.read(4)
        if magic != ELF_MAGIC:
            return None
        
        ei_class = struct.unpack('B', f.read(1))[0]  # 1 = 32-bit, 2 = 64-bit
        ei_data = struct.unpack('B', f.read(1))[0]   # 1 = little-endian, 2 = big-endian
        
        return {
            'is_64bit': ei_class == 2,
            'is_little_endian': ei_data == 1
        }

def fix_elf_alignment(file_path):
    """Fix ELF alignment by modifying program headers."""
    try:
        elf_info = read_elf_header(file_path)
        if not elf_info:
            return False
        
        # Read the entire file
        with open(file_path, 'rb') as f:
            data = bytearray(f.read())
        
        modified = False
        
        if elf_info['is_64bit']:
            # 64-bit ELF
            if len(data) < 64:
                return False
            
            # Read program header offset
            phoff = struct.unpack('<Q' if elf_info['is_little_endian'] else '>Q', 
                                 data[32:40])[0]
            phentsize = struct.unpack('<H' if elf_info['is_little_endian'] else '>H',
                                    data[54:56])[0]
            phnum = struct.unpack('<H' if elf_info['is_little_endian'] else '>H',
                                 data[56:58])[0]
            
            # Program header: p_align is at offset 48 (64-bit)
            for i in range(phnum):
                ph_offset = phoff + (i * phentsize)
                if ph_offset + 56 > len(data):
                    break
                
                # Check segment type (p_type at offset 0)
                p_type = struct.unpack('<I' if elf_info['is_little_endian'] else '>I',
                                      data[ph_offset:ph_offset+4])[0]
                
                # Type 1 = PT_LOAD
                if p_type == 1:
                    # p_align is at offset 48
                    align_offset = ph_offset + 48
                    current_align = struct.unpack('<Q' if elf_info['is_little_endian'] else '>Q',
                                                 data[align_offset:align_offset+8])[0]
                    
                    # Force 16KB alignment on ALL LOAD segments (Google Play requirement)
                    if current_align != PAGE_SIZE_16KB:
                        # Update alignment to 16KB
                        new_align = struct.pack('<Q' if elf_info['is_little_endian'] else '>Q',
                                               PAGE_SIZE_16KB)
                        data[align_offset:align_offset+8] = new_align
                        modified = True
        
        else:
            # 32-bit ELF
            if len(data) < 52:
                return False
            
            phoff = struct.unpack('<I' if elf_info['is_little_endian'] else '>I',
                                 data[28:32])[0]
            phentsize = struct.unpack('<H' if elf_info['is_little_endian'] else '>H',
                                    data[42:44])[0]
            phnum = struct.unpack('<H' if elf_info['is_little_endian'] else '>H',
                                data[44:46])[0]
            
            # Program header: p_align is at offset 28 (32-bit)
            for i in range(phnum):
                ph_offset = phoff + (i * phentsize)
                if ph_offset + 32 > len(data):
                    break
                
                p_type = struct.unpack('<I' if elf_info['is_little_endian'] else '>I',
                                      data[ph_offset:ph_offset+4])[0]
                
                if p_type == 1:  # PT_LOAD
                    align_offset = ph_offset + 28
                    current_align = struct.unpack('<I' if elf_info['is_little_endian'] else '>I',
                                                 data[align_offset:align_offset+4])[0]
                    
                    # Force 16KB alignment on ALL LOAD segments (Google Play requirement)
                    if current_align != PAGE_SIZE_16KB:
                        new_align = struct.pack('<I' if elf_info['is_little_endian'] else '>I',
                                              PAGE_SIZE_16KB)
                        data[align_offset:align_offset+4] = new_align
                        modified = True
        
        if modified:
            # Write back
            with open(file_path, 'wb') as f:
                f.write(data)
            return True
        
        return False
            
    except Exception as e:
        print(f"   ⚠️  Error fixing {os.path.basename(file_path)}: {e}")
        return False

def fix_libraries_in_directory(libs_dir):
    """Fix all .so files in a directory."""
    if not os.path.exists(libs_dir):
        print(f"⚠️  Directory not found: {libs_dir}")
        return False
    
    print(f"🔧 Fixing 16KB alignment in: {libs_dir}")
    
    # Find all .so files
    so_files = []
    for root, dirs, files in os.walk(libs_dir):
        for file in files:
            if file.endswith('.so'):
                so_path = os.path.join(root, file)
                if is_elf_file(so_path):
                    so_files.append(so_path)
    
    if not so_files:
        print("⚠️  No native libraries found")
        return False
    
    print(f"📚 Found {len(so_files)} native libraries")
    
    fixed = 0
    skipped = 0
    
    for so_file in so_files:
        lib_name = os.path.basename(so_file)
        try:
            if fix_elf_alignment(so_file):
                print(f"   ✓ Fixed: {lib_name}")
                fixed += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"   ❌ Error processing {lib_name}: {e}")
            skipped += 1
    
    print(f"✅ Fixed {fixed} libraries, {skipped} skipped/already compliant")
    return fixed > 0

def main():
    """Main function."""
    # Default to build intermediates directory
    if len(sys.argv) > 1:
        libs_dir = sys.argv[1]
    else:
        # Default path to merged native libs
        script_dir = os.path.dirname(os.path.abspath(__file__))
        libs_dir = os.path.join(script_dir, 'app/build/intermediates/merged_native_libs/release/out/lib')
    
    if not os.path.exists(libs_dir):
        print("❌ Error: Libraries directory not found")
        print(f"   Expected: {libs_dir}")
        print()
        print("Usage:")
        print(f"  {sys.argv[0]} [path/to/native/libs/directory]")
        print()
        print("The script should be run BEFORE bundleRelease, or")
        print("point it to: android/app/build/intermediates/merged_native_libs/release/out/lib")
        sys.exit(1)
    
    success = fix_libraries_in_directory(libs_dir)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()

