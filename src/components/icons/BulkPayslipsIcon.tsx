export function BulkPayslipsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="512"
      height="512"
      fill="none"
      className={className}
    >
      {/* Back Payslip */}
      <path
        d="M95 80H315L390 155V405C390 420 378 432 363 432H95C80 432 68 420 68 405V107C68 92 80 80 95 80Z"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* Front Payslip */}
      <path
        d="M125 105H345L420 180V435C420 450 408 462 393 462H125C110 462 98 450 98 435V132C98 117 110 105 125 105Z"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* Folded Corner */}
      <path
        d="M345 105V155C345 170 357 180 372 180H420"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* PAYSLIP Text */}
      <text
        x="255"
        y="225"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="48"
        fontWeight="700"
        fill="#006B2E"
      >
        PAYSLIP
      </text>
      {/* Employee Icon */}
      <circle
        cx="155"
        cy="285"
        r="25"
        stroke="#006B2E"
        strokeWidth="14"
      />
      <path
        d="M115 350C115 325 132 310 155 310C178 310 195 325 195 350"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Employee Details */}
      <path
        d="M220 275H355"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M220 310H335"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Payslip Table */}
      <rect
        x="125"
        y="365"
        width="245"
        height="70"
        rx="8"
        stroke="#006B2E"
        strokeWidth="14"
      />
      {/* Table Vertical Divider */}
      <path
        d="M250 365V435"
        stroke="#006B2E"
        strokeWidth="12"
      />
      {/* Table Horizontal Lines */}
      <path
        d="M125 388H370"
        stroke="#006B2E"
        strokeWidth="10"
      />
      <path
        d="M125 412H370"
        stroke="#006B2E"
        strokeWidth="10"
      />
      {/* Download Circle */}
      <circle
        cx="390"
        cy="390"
        r="72"
        fill="white"
        stroke="#006B2E"
        strokeWidth="16"
      />
      {/* Download Arrow */}
      <path
        d="M390 350V420"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M360 395L390 425L420 395"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Download Tray */}
      <path
        d="M350 445H430"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinecap="round"
      />
    </svg>
  );
}
