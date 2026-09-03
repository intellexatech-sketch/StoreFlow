"""Generate a large volume of demo assets for scalability testing.

Usage:
    python -m scripts.generate_load --count 10000
"""
from __future__ import annotations

import argparse
import logging

from scripts.seed import run_seed

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=10000)
    args = p.parse_args()
    run_seed(target_assets=args.count)
