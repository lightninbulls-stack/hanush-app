<FULL FILE WITH ONLY THIS CHANGE>

# inside load_sectoral_indices_performance replace rows.append block with:

        clean_name = SECTORAL_INDEX_NAMES.get(normalized_symbol, normalized_symbol)

        rows.append(
            build_performance_row(
                symbol=clean_name,
                price_series=close_df[normalized_symbol],
                category=SECTORAL_INDICES_CATEGORY,
                sector_label=clean_name,
            )
        )

# keep rest of file same
