from __future__ import annotations

import argparse
import json
from pathlib import Path


SECTION_COUNTS = {
    "listening_and_understanding": 39,
    "talking": 49,
    "reading_and_writing": 38,
    "caring_for_self": 55,
    "caring_for_home": 30,
    "living_in_the_community": 58,
    "relating_to_others": 43,
    "playing_and_using_leisure_time": 36,
    "adapting": 33,
    "using_large_muscles": 43,
    "using_small_muscles": 34,
    "problem_behaviors": 44,
}

PATCHED_TEXT_BY_ID = {
    179: "自己能按指示服药。",
    180: "自己会在需要时量体温。",
    197: "至少会使用三个厨房用具。例如：刀、钳子、铲子、蔬菜去皮机。",
    200: "会清理地板。例如：清扫、用吸尘器、用拖把。",
    323: "会主动远离可能伤害他人或破坏东西的孩子。例如：咬人、打人、扔东西、摔碎东西的孩子。",
    326: "在没有比分的简单户外团体游戏中能与他人一起玩。例如：抓人游戏、跳绳、接球。",
    346: "获取电影、体育赛事、音乐会等的日程信息。例如：查看报纸或互联网，给电影院打电话。",
    360: "会用语言或手势表达自己的沮丧，而不是尖叫、殴打、扔东西等。",
    364: "能接受他人的有益建议。",
    366: "愿意与同龄人和睦相处。",
    472: "脾气暴躁：尖叫、哭喊、踢腿等。",
    474: "在身体上或言语上欺负别人。",
    475: "谎言、欺骗或偷窃。",
    476: "表现出身体上的侵略性。例如：击打、咬。",
    478: "口头上的辱骂：故意用侮辱、贬低等方式伤害他人。",
    479: "由于同龄人的压力而违反规则或法律。",
    484: "谈论听到别人听不懂的声音，或者看到别人看不见的东西。",
    486: "使用奇怪或重复的言语。例如：在公共场合和自己交谈，说些不可以说的话。感觉一遍又一遍地重复同样的事情。",
    492: "比同龄人对武器或极端暴力显示出更多的兴趣。",
}


def validate(items: list[dict]) -> None:
    if len(items) != 502:
        raise RuntimeError(f"Expected 502 items, got {len(items)}")

    empty_ids = [item["id"] for item in items if not str(item.get("text", "")).strip()]
    if empty_ids:
        raise RuntimeError(f"Found empty item text for ids: {empty_ids}")

    counts: dict[str, int] = {}
    for item in items:
        section_key = str(item.get("sectionKey"))
        counts[section_key] = counts.get(section_key, 0) + 1

    if counts != SECTION_COUNTS:
        raise RuntimeError(f"Unexpected section counts: {counts}")

    ids = [item["id"] for item in items]
    if ids != list(range(1, 503)):
        raise RuntimeError("Question ids must be continuous from 1 to 502")


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair and validate Vineland-3 item asset.")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path("tmp_vineland_ocr_lines_hi"),
        help="Reserved for future OCR rebuild support. Currently not required for patch-based repair.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/scale-assets/vineland-3.items.json"),
        help="Vineland item asset path.",
    )
    args = parser.parse_args()

    if not args.output.exists():
        raise FileNotFoundError(f"Base asset not found: {args.output}")

    items = json.loads(args.output.read_text(encoding="utf-8"))

    for item in items:
        patched_text = PATCHED_TEXT_BY_ID.get(item["id"])
        if patched_text:
            item["text"] = patched_text

    validate(items)
    args.output.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Validated and wrote {len(items)} Vineland items to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
