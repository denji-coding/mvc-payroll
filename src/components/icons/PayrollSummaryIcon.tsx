export function PayrollSummaryIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="512"
      height="512"
      fill="none"
      className={className}
    >
      {/* Payroll Report */}
      <path
        d="M108 42H322L420 140V428C420 451 401 470 378 470H108C85 470 66 451 66 428V84C66 61 85 42 108 42Z"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      {/* Folded Corner */}
      <path
        d="M322 42V116C322 130 333 140 347 140H420"
        stroke="currentColor"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      {/* Peso Circle */}
      <circle
        cx="145"
        cy="145"
        r="55"
        stroke="currentColor"
        strokeWidth="16"
      />
      {/* Philippine Peso Sign */}
      <text
        x="145"
        y="169"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="72"
        fontWeight="700"
        fill="currentColor"
      >
        ₱
      </text>
      {/* Summary Lines */}
      <path
        d="M225 125H315"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M225 165H330"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Bar Chart */}
      <rect x="110" y="320" width="38" height="65" rx="8" fill="currentColor" />
      <rect x="165" y="285" width="38" height="100" rx="8" fill="currentColor" />
      <rect x="220" y="245" width="38" height="140" rx="8" fill="currentColor" />
      <rect x="275" y="205" width="38" height="180" rx="8" fill="currentColor" />
      {/* Bottom Lines */}
      <path
        d="M110 410H310"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M110 445H285"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Download Circle */}
      <circle
        cx="390"
        cy="390"
        r="72"
        fill="white"
        stroke="currentColor"
        strokeWidth="16"
      />
      {/* Download Arrow */}
      <path
        d="M390 350V420"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
      <path
        d="M360 395L390 425L420 395"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Download Tray */}
      <path
        d="M350 445H430"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
      />
    </svg>
  );
}
