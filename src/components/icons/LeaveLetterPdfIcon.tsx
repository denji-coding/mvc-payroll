interface Props {
  className?: string;
}

export function LeaveLetterPdfIcon({ className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* PDF Document */}
      <path
        d="M108 42 H322 L420 140 V428 C420 451 401 470 378 470 H108 C85 470 66 451 66 428 V84 C66 61 85 42 108 42Z"
        stroke="#006B2E"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      {/* Folded Corner */}
      <path
        d="M322 42 V116 C322 130 333 140 347 140 H420"
        stroke="#006B2E"
        strokeWidth="20"
        strokeLinejoin="round"
      />
      {/* PDF Label */}
      <rect
        x="42"
        y="132"
        width="270"
        height="118"
        rx="28"
        stroke="#006B2E"
        strokeWidth="20"
      />
      {/* PDF Text */}
      <text
        x="177"
        y="215"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="72"
        fontWeight="700"
        fill="#006B2E"
      >
        PDF
      </text>
      {/* Document Lines */}
      <path
        d="M116 294 H280"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M116 342 H245"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M116 390 H225"
        stroke="#006B2E"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Eye */}
      <path
        d="M270 386 C312 326 380 306 450 386 C380 466 312 446 270 386Z"
        stroke="#006B2E"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* Eye Iris */}
      <circle
        cx="360"
        cy="386"
        r="48"
        stroke="#006B2E"
        strokeWidth="16"
      />
      {/* Eye Pupil */}
      <circle
        cx="360"
        cy="386"
        r="15"
        fill="#006B2E"
      />
    </svg>
  );
}
