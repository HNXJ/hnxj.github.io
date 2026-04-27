import shutil
import os
import subprocess

# Configuration
BRAIN_DIR = "/Users/hamednejat/.gemini/antigravity/brain/3672269c-ac9a-4104-ad84-b1edecb45712"
WINTER_IMG = "hero_winter_optimized_1777306027208.png"
MIND_IMG = "hero_mind_optimized_1777306046481.png"

PROJECT_ROOT = "/Users/hamednejat/workspace/computational/hnxj_gio"
ASSETS_DIR = os.path.join(PROJECT_ROOT, "assets/images")

def run_fix():
    print("🚀 Starting Site Performance Fix...")
    
    # 1. Copy images
    try:
        shutil.copy(os.path.join(BRAIN_DIR, WINTER_IMG), os.path.join(ASSETS_DIR, "winter_opt.png"))
        shutil.copy(os.path.join(BRAIN_DIR, MIND_IMG), os.path.join(ASSETS_DIR, "mind_opt.png"))
        print("✅ Optimized images moved to assets/images/")
    except Exception as e:
        print(f"❌ Error copying images: {e}")
        return

    # 2. Git Push
    print("📦 Committing and Pushing to GitHub...")
    try:
        os.chdir(PROJECT_ROOT)
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", "Performance: Optimized hero images and deferred JS (Auto-Fix)"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("✅ Successfully pushed to hnxj.github.io!")
        print("\n🎉 Your site should now load significantly faster.")
    except Exception as e:
        print(f"❌ Error during git push: {e}")
        print("💡 Note: If git push fails, you can still use your editor's Git UI to commit and push the changes.")

if __name__ == "__main__":
    run_fix()
