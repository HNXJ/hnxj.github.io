import os

PROJECT_ROOT = "/Users/hamednejat/workspace/computational/hnxj_gio"
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets/images")

files_to_delete = [
    os.path.join(ASSETS_DIR, "winter.jpg"),
    os.path.join(ASSETS_DIR, "mind.jpg"),
    os.path.join(PROJECT_ROOT, "fix_site_performance.py"),
]

def seal():
    print("🧹 Finalizing Repository Hygiene...")
    
    # 1. Delete legacy assets
    for f in files_to_delete:
        if os.path.exists(f):
            try:
                os.remove(f)
                print(f"✅ Deleted: {os.path.basename(f)}")
            except Exception as e:
                print(f"⚠️ Could not delete {f}: {e}")

    # 2. Self-destruct
    print("\n✨ Hygiene complete. Site is now optimized and clean.")
    try:
        os.remove(__file__)
    except:
        pass

if __name__ == "__main__":
    seal()
