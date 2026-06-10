"""Test Phase 3B: World Bank Chile via econdb provider."""
import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from src.extractors.openbb_extractor import _setup_openbb, WORLD_BANK_CHILE_INDICATORS

obb = _setup_openbb()

for indicator, cfg in WORLD_BANK_CHILE_INDICATORS.items():
    print(f"\n--- {cfg['title']} ({indicator}) ---")
    try:
        result = obb.economy.indicators(
            symbol=indicator,
            country="CHL",
            provider="econdb",
            frequency="annual",
        )
        df = result.to_dataframe()
        print(f"  columns: {list(df.columns)}")
        print(f"  rows: {len(df)}")
        print(df.head(3).to_string())
    except Exception as e:
        print(f"  ERROR: {e}")
        # Try with IMF provider as fallback
        try:
            result2 = obb.economy.indicators(
                symbol=indicator,
                country="CHL",
                provider="imf",
            )
            df2 = result2.to_dataframe()
            print(f"  [IMF fallback] columns: {list(df2.columns)}, rows: {len(df2)}")
        except Exception as e2:
            print(f"  [IMF fallback] ERROR: {e2}")
