import json
import os
import re


def extract_named_points_from_text(raw_code: str):
    # 提取 downloadData JSON 对象
    match = re.search(
        r"const\s+downloadData\s*=\s*(\{.*?\});", raw_code, re.DOTALL
    )
    if not match:
        # 兼容直接粘贴纯 JSON 的情况
        match = re.search(r"(\{.*\})", raw_code, re.DOTALL)
        if not match:
            raise ValueError("未找到有效的 JSON 数据")

    data = json.loads(match.group(1))
    map_title = data.get("title", "未知地图")
    named_points = []

    # 遍历所有分类及分组，提取所有非空名称的点位
    for tab in data.get("tabs", []):
        for group in tab.get("groups", []):
            for p in group.get("points", []):
                point_name = p.get("name", "").strip()
                # 过滤出有名字的点位（如：大房、狗笼、篝火等）
                if point_name:
                    named_points.append({
                        "name": point_name,
                        "type": p.get("type", "text"),
                        "x": p["x"],
                        "y": p["y"],
                    })

    return map_title, named_points


def batch_process(input_dir=None, output_dir=None):
    here = os.path.dirname(os.path.abspath(__file__))
    input_dir = input_dir or os.path.join(here, '..', 'raw')
    output_dir = output_dir or os.path.join(here, '..', 'names')
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(input_dir):
        os.makedirs(input_dir, exist_ok=True)
        print(f"已自动创建【{input_dir}】文件夹！")
        print("请将所有地图源码文件（.txt 或 .js 格式）放入该文件夹后重新运行。")
        return

    all_summary = {}
    files = [
        f
        for f in os.listdir(input_dir)
        if f.endswith((".txt", ".js", ".json"))
    ]

    if not files:
        print(f"【{input_dir}】文件夹中未发现 txt/js 文件，请先放数据源文件。")
        return

    for filename in files:
        filepath = os.path.join(input_dir, filename)
        try:
            # 兼容多种编码读取 txt 文件
            raw_code = ""
            for encoding in ["utf-8", "gbk", "utf-8-sig"]:
                try:
                    with open(filepath, "r", encoding=encoding) as f:
                        raw_code = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            if not raw_code:
                print(f"❌ 读取失败 {filename}: 无法解析文件编码")
                continue

            map_title, points_data = extract_named_points_from_text(raw_code)

            if points_data:
                # 导出单地图名称点位 JSON
                out_file = os.path.join(output_dir, f"{map_title}_名称点位.json")
                with open(out_file, "w", encoding="utf-8") as f:
                    json.dump(points_data, f, ensure_ascii=False, indent=2)

                all_summary[map_title] = points_data
                print(f"✅ 成功提取: {filename} -> {map_title}_名称点位.json")
            else:
                print(f"⚠️ 跳过: {filename}（未在数据中找到带名称的点位）")

        except Exception as e:
            print(f"❌ 处理失败 {filename}: {e}")

    # 生成合并总表
    if all_summary:
        summary_path = os.path.join(output_dir, "_所有地图名称点位汇总.json")
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(all_summary, f, ensure_ascii=False, indent=2)
        print(f"\n🎉 批量导出完成！已在【{output_dir}】目录生成各自独立及汇总文件。")


# 核心入口：确保最底部包含这两行！
if __name__ == "__main__":
    batch_process()