import Stack from "@mui/material/Stack";
import Pagination from "@mui/material/Pagination";

export default function AppPagination({
  count,
  page,
  onChange,
  totalItems,
  pageSize,
  variant = "outlined",
  shape = "rounded",
  size = "small",
  className = "",
  ...rest
}) {
  const showPager = !!count && count > 1;
  const showMeta =
    Number.isFinite(totalItems) &&
    Number.isFinite(pageSize) &&
    pageSize > 0;

  if (!showPager && !showMeta) return null;

  const classes = ["table-pagination", className].filter(Boolean).join(" ");
  const start = !showMeta || totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = !showMeta || totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div className={classes}>
      {showMeta ? (
        <div className="table-pagination__meta">
          Showing {start} - {end} of {totalItems}
        </div>
      ) : null}
      {showPager ? (
        <Stack spacing={2}>
          <Pagination
            count={count}
            page={page}
            onChange={(_, value) => onChange?.(value)}
            variant={variant}
            shape={shape}
            size={size}
            showFirstButton
            showLastButton
            {...rest}
          />
        </Stack>
      ) : null}
    </div>
  );
}
