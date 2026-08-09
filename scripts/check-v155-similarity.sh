#!/usr/bin/env bash
# ==============================================================================
# check-v155-similarity.sh
# ------------------------------------------------------------------------------
# 结构相似度审计——归一化骨架比对（可检出改名后的重复结构，非关键词 grep）
#
# 判据（为什么这样比对）:
#   origin/archive/v1.5.5 是未发布的历史实验分支。当前实现须保持独立。
#
#   关键方向判定:
#   main 的 HEAD 就是 015ff46 (v1.4.4)。v1.5.5 是从它分叉出去的（仅 6 个 commit，
#   全在 archive 分支）。因此:
#     当前命中的同名函数若在 015ff46 里已存在  -> main 自己的代码，方向相反，
#         不算新增匹配（无害，不告警）。
#     当前命中的函数仅在当前工作区、015ff46 里不存在 -> 标记为需人工复核。
#
# 扫描范围: 当前工作区 src/ + tests/ 全部 .ts 文件 + main.ts（含未跟踪文件，
#   可捕获藏在测试目录里的草稿）。
#
# 用法:
#   ./scripts/check-v155-similarity.sh            # 在当前 repo 根目录运行
#   REPO=/path/to/sheet-extend ./scripts/check-v155-similarity.sh   # 显式指定 repo
#
# 阈值: 默认 85%（可用 THRESHOLD=NN 覆盖）。
# 退出码: 0 = 干净; 非零 = 检测到疑似外部结构，可当 CI 门禁用。
# 输出: 命中项打印「文件 函数名 相似度% [方向判定]」。
# ==============================================================================
set -uo pipefail

# ---- repo 定位 --------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"          # 默认脚本上级目录
REPO_BASE="$REPO/sheet-extend"                          # 代码库子目录
[ -d "$REPO_BASE/.git" ] || REPO_BASE="$REPO"           # 若 repo 就在脚本上级
[ -d "$REPO_BASE/.git" ] || { echo "ERROR: cannot locate git repo (tried $REPO_BASE)"; exit 2; }
cd "$REPO_BASE" || exit 2

THRESHOLD="${THRESHOLD:-85}"
V155="origin/archive/v1.5.5"
BASE_COMMIT="015ff46"                                   # main HEAD = v1.4.4
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
norm() { sed -E 's/[A-Za-z_][A-Za-z0-9_]*//g; s/[[:space:]]+//g'; }
sim()  { comm -12 <(sort -u "$1") <(sort -u "$2") | wc -l | tr -d ' '; }
pct()  { local o="$1" t="$2"; awk -v o="$o" -v t="$t" 'BEGIN{if(t>0)printf "%d",o*100/t;else print 0}'; }

# ---- 校验分支存在 -------------------------------------------------------------
if ! git cat-file -e "$V155^{commit}" 2>/dev/null; then
  echo "=== $V155 分支不存在，跳过相似度检查 ==="
  echo "=== 结果 ==="
  echo "干净: 参考分支已移除，无结构可比对。"
  exit 0
fi

# ---- 函数抽取: 把 src 下每个函数体抽成独立文件并归一化 --------------------------
# 用法: extract <tag> <git-ref-or-.ts-file>
#   ref 以 ":" 开头视为 git 对象, 否则视为工作区文件路径
extract() {
  local tag="$1" src="$2"
  awk -v tag="$tag" -v out="$WORK" '
    function fname(line,    n) {
      n = line
      if (match(n, /^[[:space:]]*(export[[:space:]]+)?function[[:space:]]+/)) n = substr(n, RLENGTH+1)
      else if (match(n, /^[[:space:]]*const[[:space:]]+/)) n = substr(n, RLENGTH+1)
      sub(/\(.*/, "", n); gsub(/[^A-Za-z0-9_]/, "_", n)
      return n
    }
    function hasBrace(s,    i, n) { n = 0; for (i=1; i<=length(s); i++){ c=substr(s,i,1); if(c=="{") n++; else if(c=="}") n-- } return n }
    /^[[:space:]]*(export[[:space:]]+)?function[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]*\(/ ||
    /^[[:space:]]*const[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]*=[[:space:]]*\(/ {
      name = fname($0); depth = 0; p = 1; buf = $0 "\n"
      depth += hasBrace($0); next
    }
    p {
      buf = buf $0 "\n"
      depth += hasBrace($0)
      if (depth <= 0) {
        print buf > (out "/" tag "_" name ".ts"); close(out "/" tag "_" name ".ts")
        p = 0
      }
    }
  ' "$src"
}

# ---- 覆盖文件清单（当前工作区 src/ + tests/ 全部 + main.ts）--------------------
FILES=$(find src tests -name '*.ts' 2>/dev/null | sort; echo "main.ts")

declare -a SUSPECTS=()

# v1.5.5 侧: 独有文件 + 共享文件
for f in src/sheet/parser.ts src/sheet/writeback.ts src/merge/interaction.ts \
         src/resizer/persistence.ts src/resizer/resizer.ts src/sheet/detect.ts \
         src/sheet/renderer.ts src/sheet/markdown-table.ts src/settings.ts \
         src/sheet/live-preview.ts src/sheet/source-view.ts src/sheet/utils.ts; do
  if git cat-file -e "$V155:$f" 2>/dev/null; then
    bname="$(echo "$f" | sed 's#/#__#g; s#\.ts$##')"
    git show "$V155:$f" > "$WORK/v155_file.ts" 2>/dev/null
    extract "V_${bname}" "$WORK/v155_file.ts"
  fi
done

# 当前工作区侧
for f in $FILES; do
  [ -f "$f" ] || continue
  bname="$(echo "$f" | sed 's#/#__#g; s#\.ts$##')"
  extract "CUR_${bname}" "$f"
done

# 015ff46 基线侧（方向判定: 该函数在 main v1.4.4 是否已存在）
for f in src/sheet/parser.ts src/sheet/writeback.ts src/merge/interaction.ts \
         src/resizer/persistence.ts src/resizer/resizer.ts src/sheet/detect.ts \
         src/sheet/renderer.ts src/sheet/markdown-table.ts src/settings.ts; do
  if git cat-file -e "$BASE_COMMIT:$f" 2>/dev/null; then
    bname="$(echo "$f" | sed 's#/#__#g; s#\.ts$##')"
    git show "$BASE_COMMIT:$f" > "$WORK/base_file.ts" 2>/dev/null
    extract "BASE_${bname}" "$WORK/base_file.ts"
  fi
done

# ---- 逐函数三方比对 ------------------------------------------------------------
found=0
for v in "$WORK"/V_*.ts; do
  [ -e "$v" ] || continue
  vname="$(basename "$v" .ts)"
  # 1) 当前工作区最佳命中
  bc=0; bcur=""
  for c in "$WORK"/CUR_*.ts; do
    [ -e "$c" ] || continue
    ov=$(sim "$v" "$c"); t=$(sort -u "$v"|wc -l|tr -d ' ')
    p=$(pct "$ov" "$t")
    [ "$p" -gt "$bc" ] && { bc="$p"; bcur="$(basename "$c" .ts)"; }
  done
  [ -n "$bcur" ] || continue
  [ "$bc" -lt "$THRESHOLD" ] && continue            # 未超阈值，跳过
  # 2) 方向判定: 该函数在 015ff46 基线是否存在（>=90% 视为已存在）
  inbase=0
  for b in "$WORK"/BASE_*.ts; do
    [ -e "$b" ] || continue
    ov=$(sim "$v" "$b"); t=$(sort -u "$v"|wc -l|tr -d ' ')
    p=$(pct "$ov" "$t")
    [ "$p" -ge 90 ] && { inbase=1; break; }
  done
  if [ "$inbase" -eq 1 ]; then
    echo "  [OK]  $vname  -> $bcur (${bc}%)  方向=main自身(历史分支与main重复)"
  else
    echo "  [!!!] $vname  -> $bcur (${bc}%)  方向=需人工复核"
    SUSPECTS+=("$vname -> $bcur (${bc}%)")
    found=1
  fi
done

echo ""
echo "=== 结果 ==="
if [ "$found" -eq 0 ]; then
  echo "干净: 未检测到需复核的结构匹配。阈值=${THRESHOLD}%。"
  exit 0
else
  echo "检测到需人工复核的匹配 ${#SUSPECTS[@]} 处:"
  for s in "${SUSPECTS[@]}"; do echo "  - $s"; done
  echo "请人工复核上述项。"
  exit 1
fi
